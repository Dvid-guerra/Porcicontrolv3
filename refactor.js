const fs = require('fs');
const file = './src/App.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add Menu import
if (!content.includes(' Menu')) {
    content = content.replace(/Download, LogOut\n/g, 'Download, LogOut, Menu\n');
}

// 2. Add isSidebarOpen state
if (!content.includes('isSidebarOpen')) {
    content = content.replace(
        "const [tabActiva, setTabActiva] = useState('resumen');",
        "const [tabActiva, setTabActiva] = useState('resumen');\n  const [isSidebarOpen, setIsSidebarOpen] = useState(false);"
    );
}

// 3. Update Sidebar Layout
// Original: <aside className="w-72 bg-slate-900 text-slate-300 flex flex-col shadow-2xl relative z-20">
const originalSidebar = '<aside className="w-72 bg-slate-900 text-slate-300 flex flex-col shadow-2xl relative z-20">';
const newSidebar = `{isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-30 md:hidden backdrop-blur-sm transition-opacity" 
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}
      <aside className={\`fixed inset-y-0 left-0 z-40 w-72 bg-slate-900 text-slate-300 flex flex-col shadow-2xl transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 \${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}\`}>`;

content = content.replace(originalSidebar, newSidebar);

// Close sidebar on navigation clicks
content = content.replace(/setVista\('dashboard'\); setCorralSeleccionado\(null\); \}\}/g, "setVista('dashboard'); setCorralSeleccionado(null); setIsSidebarOpen(false); }}");
content = content.replace(/setVista\('bodega'\); setCorralSeleccionado\(null\); \}\}/g, "setVista('bodega'); setCorralSeleccionado(null); setIsSidebarOpen(false); }}");
content = content.replace(/setVista\('laboratorio'\); setCorralSeleccionado\(null\); \}\}/g, "setVista('laboratorio'); setCorralSeleccionado(null); setIsSidebarOpen(false); }}");
content = content.replace(/setVista\('historial'\); setCorralSeleccionado\(null\); \}\}/g, "setVista('historial'); setCorralSeleccionado(null); setIsSidebarOpen(false); }}");
content = content.replace(/setVista\('config'\); setCorralSeleccionado\(null\); \}\}/g, "setVista('config'); setCorralSeleccionado(null); setIsSidebarOpen(false); }}");

// 4. Update Header
// Original: <header className="bg-white border-b border-slate-200 p-6 shadow-sm flex items-center justify-between relative z-10">
const originalHeader = '<header className="bg-white border-b border-slate-200 p-6 shadow-sm flex items-center justify-between relative z-10">\n          <h2 className="text-xl font-bold text-slate-800 flex items-center">';
const newHeader = `<header className="bg-white border-b border-slate-200 p-4 md:p-6 shadow-sm flex items-center justify-between relative z-10">
          <div className="flex items-center">
            <button onClick={() => setIsSidebarOpen(true)} className="mr-4 md:hidden text-slate-500 hover:text-emerald-600 transition-colors">
              <Menu size={24} />
            </button>
            <h2 className="text-xl font-bold text-slate-800 flex items-center">`;
content = content.replace(originalHeader, newHeader);

// Close the flex div added around the h2
content = content.replace(/<\/h2>\n          <div className="text-xs/g, '</h2>\n          </div>\n          <div className="text-xs');

// 5. Replace Grid Layouts to make them responsive
content = content.replace(/className="grid grid-cols-2 /g, 'className="grid grid-cols-1 md:grid-cols-2 ');
content = content.replace(/className="grid grid-cols-3 /g, 'className="grid grid-cols-1 lg:grid-cols-3 ');

// For PDF elements, maybe we shouldn't change them because they are for print. Let's revert grid-cols-2 changes inside print wrappers if they exist, but actually a media query like md: won't hurt print if the print window is large, but to be safe:
// Print areas have specific IDs or are in 'imprimirFicha'
content = content.replace(/className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10"/g, 'className="grid grid-cols-2 gap-8 mb-10"'); // Used in PDF
content = content.replace(/className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10 text-center"/g, 'className="grid grid-cols-2 gap-8 mb-10 text-center"'); // Used in PDF

// Replace specific padding p-8 with responsive
content = content.replace(/ className="p-8 max-w-5xl mx-auto/g, ' className="p-4 md:p-8 max-w-5xl mx-auto');
content = content.replace(/ className="bg-slate-100 min-h-screen p-8/g, ' className="bg-slate-100 min-h-screen p-4 md:p-8');
content = content.replace(/ className="p-8 max-w-7xl mx-auto/g, ' className="p-4 md:p-8 max-w-7xl mx-auto');

// 6. Tables Overflow
// Find instances of rounded-xl overflow-hidden shadow-sm containing tables and replace with overflow-x-auto
content = content.replace(/overflow-hidden shadow-sm/g, 'overflow-x-auto shadow-sm');
// And specific case:
content = content.replace(/rounded-2xl overflow-hidden shadow-sm/g, 'rounded-2xl overflow-x-auto shadow-sm');

fs.writeFileSync(file, content, 'utf8');
console.log('App.jsx refactored successfully!');
