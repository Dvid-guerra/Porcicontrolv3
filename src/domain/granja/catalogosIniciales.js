export const INITIAL_CATALOGO = [
  { id: 'vl1', nombre: 'VITALECHON 1', precioSaco: 394, librasPorSaco: 50 },
  { id: 'vl2', nombre: 'VITALECHON 2', precioSaco: 289, librasPorSaco: 50 },
  { id: 'vl3', nombre: 'VITALECHON 3', precioSaco: 222, librasPorSaco: 50 },
  { id: 'vl4', nombre: 'VITALECHON 4', precioSaco: 326, librasPorSaco: 50 },
  { id: 'vc1', nombre: 'VITACERDO 1', precioSaco: 294, librasPorSaco: 100 },
  { id: 'vc2', nombre: 'VITACERDO 2', precioSaco: 264, librasPorSaco: 100 },
  { id: 'vc3', nombre: 'VITACERDO 3', precioSaco: 259, librasPorSaco: 100 },
];

export const INITIAL_CATALOGO_MEDICO = [
  { id: 'med1', nombre: 'Electrolitos orales', categoria: 'Hidratación', unidad: 'sobre', stockMinimo: 2, diasAlertaVencimiento: 30 },
  { id: 'med2', nombre: 'Multivitamínico oral', categoria: 'Vitaminado', unidad: 'frasco', stockMinimo: 1, diasAlertaVencimiento: 45 },
  { id: 'med3', nombre: 'Fenbendazol', categoria: 'Desparasitación', unidad: 'frasco', stockMinimo: 1, diasAlertaVencimiento: 45 },
  { id: 'med4', nombre: 'Ivermectina / Doramectina', categoria: 'Antiparasitario', unidad: 'frasco', stockMinimo: 1, diasAlertaVencimiento: 45 },
  { id: 'med5', nombre: 'Desinfectante de instalaciones', categoria: 'Bioseguridad', unidad: 'galón', stockMinimo: 1, diasAlertaVencimiento: 60 },
];

export const INITIAL_CATALOGO_INSUMOS = [
  { id: 'ins1', nombre: 'Viruta / aserrín', categoria: 'Cama', unidad: 'saco', stockMinimo: 5 },
  { id: 'ins2', nombre: 'Cal hidratada', categoria: 'Bioseguridad', unidad: 'saco', stockMinimo: 2 },
  { id: 'ins3', nombre: 'Desinfectante de corrales', categoria: 'Bioseguridad', unidad: 'galón', stockMinimo: 1 },
  { id: 'ins4', nombre: 'Guantes desechables', categoria: 'Manejo', unidad: 'caja', stockMinimo: 1 },
  { id: 'ins5', nombre: 'Jeringas y agujas', categoria: 'Manejo', unidad: 'paquete', stockMinimo: 2 }
];

export const CRONOGRAMA_ALIMENTACION = [
  { fase: 1, alimento: 'VITALECHON 1', diaInicio: 1, diaFin: 11, consumoTotalLb: 6.6 },
  { fase: 2, alimento: 'VITALECHON 2', diaInicio: 12, diaFin: 21, consumoTotalLb: 11.0 },
  { fase: 3, alimento: 'VITALECHON 3', diaInicio: 22, diaFin: 28, consumoTotalLb: 11.0 },
  { fase: 4, alimento: 'VITALECHON 4', diaInicio: 29, diaFin: 49, consumoTotalLb: 48.4 },
  { fase: 5, alimento: 'VITACERDO 1', diaInicio: 50, diaFin: 70, consumoTotalLb: 74.8 },
  { fase: 6, alimento: 'VITACERDO 2', diaInicio: 71, diaFin: 105, consumoTotalLb: 175.1 },
  { fase: 7, alimento: 'VITACERDO 3', diaInicio: 106, diaFin: 133, consumoTotalLb: 169.5 },
];

export const CORRALES_INICIALES = [
  { id: 'c1', nombre: 'Corral 1', capacidad: 15 },
  { id: 'c2', nombre: 'Corral 2', capacidad: 15 },
  { id: 'c3', nombre: 'Corral 3', capacidad: 15 },
  { id: 'c4', nombre: 'Corral 4', capacidad: 15 },
];
