import { describe, expect, it } from 'vitest';
import {
  MIN_DIAS_ENTRE_DOSIS,
  MIN_DIAS_SEGUNDA_DOSIS_A_VENTA,
  calcularPlanInnosure,
  composicionLote,
  planificarSincronizacion,
  validarFechaDosis
} from './sanitaryPlan.js';

describe('composicionLote', () => {
  it('cuenta los machos enteros descontando los capados', () => {
    const c = composicionLote({ cantidad: 10, machos: 6, hembras: 4, machosCapados: 2 });
    expect(c.machosEnteros).toBe(4);
    expect(c.descuadreSexo).toBe(false);
  });

  it('no deja capar mas machos de los que hay', () => {
    const c = composicionLote({ cantidad: 10, machos: 3, hembras: 7, machosCapados: 99 });
    expect(c.machosCapados).toBe(3);
    expect(c.machosEnteros).toBe(0);
  });

  it('avisa cuando el desglose por sexo no cuadra con la cantidad', () => {
    const c = composicionLote({ cantidad: 10, machos: 6, hembras: 3 });
    expect(c.descuadreSexo).toBe(true);
    expect(c.diferenciaSexo).toBe(-1);
  });

  it('no marca descuadre si todavia no se registro el sexo', () => {
    expect(composicionLote({ cantidad: 10 }).descuadreSexo).toBe(false);
  });

  // Caso real del Corral 4: ingresaron 10, se vendio 1, y el productor cuenta
  // "6 machos y 3 hembras" sobre los 9 que quedan vivos hoy.
  it('compara contra los vivos de hoy y no contra la cantidad de ingreso', () => {
    const lote = { cantidad: 10, machos: 6, hembras: 3, machosCapados: 0 };
    expect(composicionLote(lote, 9).descuadreSexo).toBe(false);
    expect(composicionLote(lote, 9).machosEnteros).toBe(6);
    // Sin el conteo de vivos se compara contra el ingreso y sí marca descuadre.
    expect(composicionLote(lote).descuadreSexo).toBe(true);
  });
});

describe('calcularPlanInnosure', () => {
  const loteBase = { id: 'l1', cantidad: 10, fechaIngreso: '2026-01-01', machos: 6, hembras: 4, machosCapados: 0 };

  it('no aplica si todos los machos estan capados', () => {
    const r = calcularPlanInnosure({
      lote: { ...loteBase, machosCapados: 6 },
      now: new Date('2026-06-01T12:00:00')
    });
    expect(r.aplica).toBe(false);
    expect(r.puedeVender).toBe(true);
  });

  it('no aplica en un lote de puras hembras', () => {
    const r = calcularPlanInnosure({
      lote: { ...loteBase, machos: 0, hembras: 10 },
      now: new Date('2026-06-01T12:00:00')
    });
    expect(r.aplica).toBe(false);
  });

  it('usa el plan de 22 semanas por defecto', () => {
    const r = calcularPlanInnosure({ lote: loteBase, now: new Date('2026-01-15T12:00:00') });
    expect(r.plan).toBe(22);
    expect(r.primeraDosis.fechaSugerida).toBe('2026-03-26'); // dia 84
    expect(r.segundaDosis.fechaSugerida).toBe('2026-05-07'); // dia 126
  });

  it('respeta el plan de 20 semanas cuando el lote lo pide', () => {
    const r = calcularPlanInnosure({
      lote: { ...loteBase, planInnosure: 20 },
      now: new Date('2026-01-15T12:00:00')
    });
    expect(r.primeraDosis.fechaSugerida).toBe('2026-03-12'); // dia 70
  });

  it('bloquea la venta mientras falte la primera dosis', () => {
    const r = calcularPlanInnosure({ lote: loteBase, now: new Date('2026-06-01T12:00:00') });
    expect(r.puedeVender).toBe(false);
    expect(r.motivoBloqueo).toContain('1ª dosis');
  });

  it('recalcula la segunda dosis desde la primera REAL, no desde el ingreso', () => {
    const tareas = [
      { id: 't1', loteId: 'l1', innosureDosis: 1, estado: 'hecho', completadoEn: '2026-06-10' }
    ];
    const r = calcularPlanInnosure({ lote: loteBase, tareas, now: new Date('2026-06-15T12:00:00') });

    expect(r.primeraDosis.aplicada).toBe(true);
    // Este lote va atrasado (la 1a tocaba el 26-mar), así que aplica el plan flexible
    // de 3 semanas en vez de las 6 del estándar.
    expect(r.atrasado).toBe(true);
    expect(r.segundaDosis.fechaSugerida).toBe('2026-07-01');
    expect(r.segundaDosis.fechaMinima).toBe('2026-06-24');
    expect(r.puedeVender).toBe(false);
    expect(r.motivoBloqueo).toContain('2ª dosis');
  });

  it('mantiene las 6 semanas del plan estandar cuando el lote va a tiempo', () => {
    const tareas = [
      // La 1a dosis tocaba el 26-mar y se aplicó el 24-mar: el lote va al día.
      { id: 't1', loteId: 'l1', innosureDosis: 1, estado: 'hecho', completadoEn: '2026-03-24' }
    ];
    const r = calcularPlanInnosure({ lote: loteBase, tareas, now: new Date('2026-03-25T12:00:00') });

    expect(r.atrasado).toBe(false);
    expect(r.separacionAplicadaDias).toBe(42);
    expect(r.segundaDosis.fechaSugerida).toBe('2026-05-05');
  });

  it('habilita la venta exactamente 21 dias despues de la segunda dosis', () => {
    const tareas = [
      { id: 't1', loteId: 'l1', innosureDosis: 1, estado: 'hecho', completadoEn: '2026-06-10' },
      { id: 't2', loteId: 'l1', innosureDosis: 2, estado: 'hecho', completadoEn: '2026-07-22' }
    ];

    const antes = calcularPlanInnosure({ lote: loteBase, tareas, now: new Date('2026-08-11T12:00:00') });
    expect(antes.ventaHabilitadaDesde).toBe('2026-08-12');
    expect(antes.puedeVender).toBe(false);
    expect(antes.diasParaPoderVender).toBe(1);

    const elDia = calcularPlanInnosure({ lote: loteBase, tareas, now: new Date('2026-08-12T12:00:00') });
    expect(elDia.puedeVender).toBe(true);
    expect(elDia.motivoBloqueo).toBeNull();
  });

  it('marca la dosis vencida cuando ya paso la fecha sugerida', () => {
    const r = calcularPlanInnosure({ lote: loteBase, now: new Date('2026-05-01T12:00:00') });
    expect(r.primeraDosis.vencida).toBe(true);
    expect(r.primeraDosis.diasDeAtraso).toBe(36);
  });

  // Caso real tomado del plan de corrales de la granja: el Corral 3 aplico la 1a dosis
  // en la semana 19 en vez de la 12, y aun asi respeto el minimo de 3 semanas a la salida.
  it('valida el caso real del Corral 3', () => {
    const lote = { id: 'c3', cantidad: 7, fechaIngreso: '2026-03-21', machos: 4, hembras: 3, machosCapados: 0 };
    const tareas = [
      { id: 'a', loteId: 'c3', innosureDosis: 1, estado: 'hecho', completadoEn: '2026-07-30' },
      { id: 'b', loteId: 'c3', innosureDosis: 2, estado: 'hecho', completadoEn: '2026-08-25' }
    ];
    const r = calcularPlanInnosure({ lote, tareas, now: new Date('2026-09-22T12:00:00') });

    // La salida real fue el 2026-09-15: justo despues del minimo habilitado.
    expect(r.ventaHabilitadaDesde).toBe('2026-09-15');
    expect(r.puedeVender).toBe(true);
  });
});

describe('validarFechaDosis', () => {
  it('rechaza una segunda dosis demasiado pegada a la primera', () => {
    const r = validarFechaDosis({ numero: 2, fecha: '2026-06-20', fechaPrimeraDosis: '2026-06-10' });
    expect(r.valida).toBe(false);
    expect(r.mensaje).toContain('2026-06-24');
  });

  it('acepta la segunda dosis al cumplirse el minimo', () => {
    const r = validarFechaDosis({ numero: 2, fecha: '2026-06-24', fechaPrimeraDosis: '2026-06-10' });
    expect(r.valida).toBe(true);
  });

  it('exige que exista la primera dosis', () => {
    const r = validarFechaDosis({ numero: 2, fecha: '2026-06-24', fechaPrimeraDosis: null });
    expect(r.valida).toBe(false);
  });

  it('no restringe la primera dosis', () => {
    expect(validarFechaDosis({ numero: 1, fecha: '2026-06-10' }).valida).toBe(true);
  });
});

describe('constantes del protocolo', () => {
  it('mantiene los minimos del plan de la granja', () => {
    expect(MIN_DIAS_ENTRE_DOSIS).toBe(14);
    expect(MIN_DIAS_SEGUNDA_DOSIS_A_VENTA).toBe(21);
  });
});

describe('planificarSincronizacion', () => {
  const pasos = [
    { id: 'ps1', dia: 0, tarea: 'Sueros y electrolitos en agua' },
    { id: 'ps4', dia: 7, tarea: 'Desparasitación' },
    { id: 'ps6', dia: 28, tarea: 'Segunda desparasitación' }
  ];
  const lote = { id: 'L', fechaIngreso: '2026-01-01', cantidad: 10, machos: 0, hembras: 10 };

  it('agrega el protocolo completo a un lote que no tiene nada', () => {
    const r = planificarSincronizacion({ lote, pasosProtocolo: pasos, tareasActuales: [] });
    expect(r.agregar).toHaveLength(3);
    expect(r.agregar[0].fechaObjetivo).toBe('2026-01-01');
    expect(r.agregar[1].fechaObjetivo).toBe('2026-01-08');
    expect(r.eliminar).toHaveLength(0);
    expect(r.sinCambios).toBe(false);
  });

  it('suma las dos dosis de Innosure cuando hay machos enteros', () => {
    const r = planificarSincronizacion({
      lote: { ...lote, machos: 6, hembras: 4, machosCapados: 0 },
      pasosProtocolo: pasos,
      tareasActuales: []
    });
    expect(r.agregar).toHaveLength(5);
    const innosure = r.agregar.filter(a => a.innosureDosis);
    expect(innosure.map(i => i.fechaObjetivo)).toEqual(['2026-03-26', '2026-05-07']);
    expect(innosure[0].machosEnteros).toBe(6);
  });

  // Los corrales 7, 8 y 9 arrastran tareas de un protocolo que ya no existe, todas
  // aplicadas. Son historial sanitario real y no se pueden borrar.
  it('conserva las tareas ya aplicadas aunque su paso ya no exista', () => {
    const tareasActuales = [
      { id: 'v1', loteId: 'L', protocoloId: 'viejo1', tarea: 'Vacunación Mycoplasma / Circovirus', estado: 'hecho', completadoEn: '2026-01-05' },
      { id: 'v2', loteId: 'L', protocoloId: 'viejo2', tarea: 'Aplicación de Hierro', estado: 'hecho', completadoEn: '2026-01-03' }
    ];
    const r = planificarSincronizacion({ lote, pasosProtocolo: pasos, tareasActuales });

    expect(r.eliminar).toHaveLength(0);
    expect(r.conservar.map(t => t.id)).toEqual(['v1', 'v2']);
    expect(r.agregar).toHaveLength(3);
  });

  it('elimina las tareas pendientes cuyo paso desaparecio del protocolo', () => {
    const tareasActuales = [
      { id: 'o1', loteId: 'L', protocoloId: 'ps3', tarea: 'Observación sin medicar', estado: 'pendiente', fechaObjetivo: '2026-01-05' },
      { id: 'o2', loteId: 'L', protocoloId: 'ps5', tarea: 'Revisión clínica', estado: 'pendiente', fechaObjetivo: '2026-01-15' }
    ];
    const r = planificarSincronizacion({ lote, pasosProtocolo: pasos, tareasActuales });

    expect(r.eliminar.map(t => t.id)).toEqual(['o1', 'o2']);
  });

  it('reprograma una tarea pendiente con la fecha corrida', () => {
    const tareasActuales = [
      { id: 'p1', loteId: 'L', protocoloId: 'ps4', dia: 7, estado: 'pendiente', fechaObjetivo: '2026-02-20' }
    ];
    const r = planificarSincronizacion({ lote, pasosProtocolo: pasos, tareasActuales });

    expect(r.reprogramar).toHaveLength(1);
    expect(r.reprogramar[0].fechaObjetivo).toBe('2026-01-08');
  });

  it('no propone cambios si el lote ya esta al dia', () => {
    const tareasActuales = pasos.map((p, i) => ({
      id: `t${i}`, loteId: 'L', protocoloId: p.id, dia: p.dia, estado: 'pendiente',
      fechaObjetivo: ['2026-01-01', '2026-01-08', '2026-01-29'][i]
    }));
    const r = planificarSincronizacion({ lote, pasosProtocolo: pasos, tareasActuales });

    expect(r.sinCambios).toBe(true);
  });

  it('no toca las tareas de otros lotes', () => {
    const tareasActuales = [
      { id: 'x', loteId: 'OTRO', protocoloId: 'ps1', estado: 'pendiente', fechaObjetivo: '2020-01-01' }
    ];
    const r = planificarSincronizacion({ lote, pasosProtocolo: pasos, tareasActuales });
    expect(r.eliminar).toHaveLength(0);
  });

  it('no reprograma una dosis de Innosure ya aplicada', () => {
    const tareasActuales = [
      { id: 'd1', loteId: 'L', innosureDosis: 1, estado: 'hecho', completadoEn: '2026-07-30' }
    ];
    const r = planificarSincronizacion({
      lote: { ...lote, machos: 6, hembras: 4 },
      pasosProtocolo: pasos,
      tareasActuales
    });

    expect(r.reprogramar).toHaveLength(0);
    expect(r.conservar.map(t => t.id)).toEqual(['d1']);
    expect(r.agregar.filter(a => a.innosureDosis).map(a => a.innosureDosis)).toEqual([2]);
  });
});

describe('recalculo de salida por atrasos', () => {
  const lote = { id: 'lr', cantidad: 10, fechaIngreso: '2026-01-01', machos: 6, hembras: 4, machosCapados: 0 };

  it('sin atrasos la salida es la teorica del plan de 22 semanas', () => {
    const r = calcularPlanInnosure({ lote, now: new Date('2026-01-05T12:00:00') });
    expect(r.salidaTeorica).toBe('2026-06-04'); // dia 154
    expect(r.salidaSugerida).toBe('2026-06-04');
    expect(r.diasDeAtrasoSalida).toBe(0);
    expect(r.atrasado).toBe(false);
    expect(r.separacionAplicadaDias).toBe(42);
  });

  it('pasa al plan flexible de 3 semanas cuando el lote va atrasado', () => {
    // 1a dosis aplicada el dia 132 en vez del 84.
    const tareas = [{ id: 'a', loteId: 'lr', innosureDosis: 1, estado: 'hecho', completadoEn: '2026-05-13' }];
    const r = calcularPlanInnosure({ lote, tareas, now: new Date('2026-05-20T12:00:00') });

    expect(r.atrasado).toBe(true);
    expect(r.modoFlexible).toBe(true);
    expect(r.separacionAplicadaDias).toBe(21);
    // 2a sugerida a 3 semanas de la real, no a 6.
    expect(r.segundaDosis.fechaSugerida).toBe('2026-06-03');
  });

  it('corre la fecha de salida cuando la segunda dosis se atrasa', () => {
    const tareas = [
      { id: 'a', loteId: 'lr', innosureDosis: 1, estado: 'hecho', completadoEn: '2026-05-13' },
      { id: 'b', loteId: 'lr', innosureDosis: 2, estado: 'hecho', completadoEn: '2026-06-10' }
    ];
    const r = calcularPlanInnosure({ lote, tareas, now: new Date('2026-06-15T12:00:00') });

    // 10-jun + 21 dias obligatorios = 1-jul, muy despues de la salida teorica del 4-jun.
    expect(r.salidaSugerida).toBe('2026-07-01');
    expect(r.ventaHabilitadaDesde).toBe('2026-07-01');
    expect(r.diasDeAtrasoSalida).toBe(27);
  });

  it('proyecta la salida aun sin haber aplicado ninguna dosis', () => {
    const r = calcularPlanInnosure({ lote, now: new Date('2026-01-05T12:00:00') });
    // 2a sugerida (dia 126) + 21 = 19-jun, posterior a la teorica del 4-jun.
    expect(r.segundaDosis.fechaSugerida).toBe('2026-05-07');
    expect(r.salidaSugerida).toBe('2026-06-04');
  });

  // El Corral 3 del plan de corrales real: entro el 21-mar, 1a dosis el 30-jul
  // (semana 19, muy atrasado), 2a el 25-ago, y salio el 15-sep.
  it('reproduce la salida real del Corral 3', () => {
    const c3 = { id: 'c3', cantidad: 7, fechaIngreso: '2026-03-21', machos: 4, hembras: 3, machosCapados: 0 };
    const tareas = [
      { id: 'a', loteId: 'c3', innosureDosis: 1, estado: 'hecho', completadoEn: '2026-07-30' },
      { id: 'b', loteId: 'c3', innosureDosis: 2, estado: 'hecho', completadoEn: '2026-08-25' }
    ];
    const r = calcularPlanInnosure({ lote: c3, tareas, now: new Date('2026-09-22T12:00:00') });

    expect(r.atrasado).toBe(true);
    expect(r.salidaTeorica).toBe('2026-08-22');
    // La salida recalculada coincide con la venta real del 15-sep.
    expect(r.salidaSugerida).toBe('2026-09-15');
    expect(r.diasDeAtrasoSalida).toBe(24);
  });
});

describe('proyeccion desde hoy cuando la dosis ya venció', () => {
  // Reproduce el estado real de los lotes viejos: la 1ª dosis lleva meses vencida y
  // nunca se aplicó. La salida no puede seguir siendo la teórica del plan.
  const c3 = { id: 'c3v', cantidad: 5, fechaIngreso: '2026-03-21', machos: 5, hembras: 0, machosCapados: 0 };

  it('proyecta desde hoy y corre la salida cuando la 1ª dosis está vencida', () => {
    const r = calcularPlanInnosure({ lote: c3, now: new Date('2026-09-22T12:00:00') });

    expect(r.primeraDosis.fechaSugerida).toBe('2026-06-13');   // la del plan, ya pasada
    expect(r.primeraDosis.vencida).toBe(true);
    expect(r.primeraDosis.diasDeAtraso).toBe(101);
    // Lo antes que puede pincharse es hoy.
    expect(r.primeraDosis.fechaProyectada).toBe('2026-09-22');
    // Plan flexible de 3 semanas desde hoy.
    expect(r.segundaDosis.fechaProyectada).toBe('2026-10-13');
    // Y la salida se corre 3 semanas más allá de esa segunda dosis.
    expect(r.salidaTeorica).toBe('2026-08-22');
    expect(r.salidaSugerida).toBe('2026-11-03');
    expect(r.diasDeAtrasoSalida).toBe(73);
  });

  it('un lote nuevo con las dosis por delante no se proyecta desde hoy', () => {
    const nuevo = { ...c3, fechaIngreso: '2026-09-01' };
    const r = calcularPlanInnosure({ lote: nuevo, now: new Date('2026-09-22T12:00:00') });

    expect(r.primeraDosis.vencida).toBe(false);
    expect(r.primeraDosis.fechaProyectada).toBe('2026-11-24'); // la del plan
    expect(r.diasDeAtrasoSalida).toBe(0);
  });
});

describe('Innosure sin desglose de sexo cargado', () => {
  // Los lotes viejos tienen sus dosis en el plan de corrales pero nunca se les cargó
  // machos/hembras en la app. El bloqueo de venta no puede depender de ese dato.
  const lote = { id: 'sx', cantidad: 10, fechaIngreso: '2026-04-18' };

  it('aplica el plan si hay dosis registradas aunque falte el sexo', () => {
    const tareas = [
      { id: 'a', loteId: 'sx', innosureDosis: 1, estado: 'hecho', completadoEn: '2026-07-30' },
      { id: 'b', loteId: 'sx', innosureDosis: 2, estado: 'hecho', completadoEn: '2026-09-02' }
    ];
    const r = calcularPlanInnosure({ lote, tareas, now: new Date('2026-09-10T12:00:00') });

    expect(r.aplica).toBe(true);
    expect(r.aplicaSinComposicion).toBe(true);
    expect(r.machosEnteros).toBe(0);
    // Y sobre todo: bloquea la venta hasta el 23-sep.
    expect(r.ventaHabilitadaDesde).toBe('2026-09-23');
    expect(r.puedeVender).toBe(false);
  });

  it('sigue sin aplicar a un lote sin dosis y sin machos enteros', () => {
    const r = calcularPlanInnosure({ lote, now: new Date('2026-09-10T12:00:00') });
    expect(r.aplica).toBe(false);
    expect(r.puedeVender).toBe(true);
  });

  it('la sincronizacion no borra una dosis pendiente por falta de sexo', () => {
    const tareas = [
      { id: 'p', loteId: 'sx', innosureDosis: 2, estado: 'pendiente', fechaObjetivo: '2026-09-21' }
    ];
    const r = planificarSincronizacion({ lote, pasosProtocolo: [], tareasActuales: tareas });

    expect(r.eliminar).toHaveLength(0);
    expect(r.conservar.map(t => t.id)).toEqual(['p']);
  });

  it('no reprograma una dosis pendiente a la fecha teorica del plan', () => {
    const tareas = [
      // Fecha real planificada por el productor, distinta del día 126 del plan.
      { id: 'p', loteId: 'sx', innosureDosis: 2, estado: 'pendiente', dia: 126, fechaObjetivo: '2026-09-21' }
    ];
    const r = planificarSincronizacion({ lote, pasosProtocolo: [], tareasActuales: tareas });

    expect(r.reprogramar).toHaveLength(0);
    expect(r.conservar[0].fechaObjetivo).toBe('2026-09-21');
  });
});
