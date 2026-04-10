import re

def redesign():
    with open('public/dashboard.backup.html', 'r', encoding='utf-8') as f:
        html = f.read()

    # The Tailwind configuration and custom @apply logic
    tailwind_setup = """
    <!-- Tailwind CSS (CDN Base) -->
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <script>
        tailwind.config = {
            darkMode: 'class',
            theme: {
                extend: {
                    fontFamily: {
                        sans: ['Outfit', 'sans-serif'],
                    },
                    colors: {
                        primary: '#4f46e5',
                        'primary-dark': '#4338ca',
                        secondary: '#10b981',
                        accent: '#8b5cf6',
                        danger: '#ef4444',
                        success: '#10b981',
                    },
                    animation: {
                        'fade-in': 'fadeIn 0.5s ease-out forwards',
                        'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                    },
                    keyframes: {
                        fadeIn: {
                            '0%': { opacity: '0', transform: 'translateY(10px)' },
                            '100%': { opacity: '1', transform: 'translateY(0)' },
                        },
                        slideUp: {
                            '0%': { opacity: '0', transform: 'translateY(20px) scale(0.95)' },
                            '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
                        }
                    }
                }
            }
        }
    </script>

    <style type="text/tailwindcss">
        @layer base {
            body { 
                @apply bg-slate-50 text-slate-800 dark:bg-slate-900 dark:text-slate-100 font-sans antialiased selection:bg-primary selection:text-white transition-colors duration-300;
                background-image: radial-gradient(circle at 15% 50%, rgba(79, 70, 229, 0.08), transparent 25%), radial-gradient(circle at 85% 30%, rgba(16, 185, 129, 0.08), transparent 25%);
            }
            .dark body {
                background-image: radial-gradient(circle at 15% 50%, rgba(79, 70, 229, 0.15), transparent 25%), radial-gradient(circle at 85% 30%, rgba(16, 185, 129, 0.12), transparent 25%);
            }
            h1, h2, h3, h4, h5 { @apply font-semibold tracking-tight; }
        }

        @layer components {
            .dashboard-container { @apply flex min-h-screen overflow-hidden relative; }
            
            /* Sidebar */
            .sidebar { @apply w-72 bg-white/70 dark:bg-slate-800/50 backdrop-blur-xl border-r border-slate-200/50 dark:border-slate-700/50 flex flex-col p-6 fixed h-screen z-50 transition-all duration-300 shadow-2xl; }
            .sidebar.collapsed { @apply -translate-x-full opacity-0 pointer-events-none; }
            .brand-section { @apply flex items-center gap-4 mb-10 px-2; }
            .logo-container { @apply w-12 h-12 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-[14px] flex items-center justify-center text-white shadow-lg shadow-indigo-500/30 border border-white/20; }
            .brand-text { @apply text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent; }
            
            /* Navigation */
            .nav-menu { @apply flex-1 overflow-y-auto custom-scroll -mr-2 pr-2; }
            .nav-item { @apply mb-2; }
            .nav-link { @apply flex items-center gap-4 px-4 py-3 rounded-2xl text-slate-500 dark:text-slate-400 font-medium transition-all duration-300 hover:bg-white dark:hover:bg-slate-700/50 hover:text-indigo-600 dark:hover:text-white hover:shadow-sm; }
            .nav-link.active { @apply bg-white dark:bg-slate-700/80 text-indigo-600 dark:text-white shadow-md shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-600/50 relative overflow-hidden; }
            .nav-link.active::before { content: ''; @apply absolute left-0 top-1/4 bottom-1/4 w-1 bg-indigo-600 dark:bg-indigo-400 rounded-r-md; }
            
            .nav-submenu { @apply ml-12 mt-1 hidden overflow-hidden transition-all duration-300; }
            .nav-submenu-link { @apply flex items-center gap-3 px-4 py-2 text-sm text-slate-500 dark:text-slate-400 font-medium rounded-xl hover:bg-white dark:hover:bg-slate-700/50 hover:text-indigo-600 dark:hover:text-white transition-colors; }
            .nav-submenu-link.active { @apply text-indigo-600 dark:text-white font-semibold; }
            
            .sidebar-footer { @apply mt-auto pt-4 border-t border-slate-200 dark:border-slate-700/50; }
            .sidebar-card { @apply p-4 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 dark:from-indigo-500/20 dark:to-purple-500/20 rounded-2xl border border-indigo-500/20; }
            .sidebar-card h4 { @apply flex items-center gap-2 text-sm font-semibold text-indigo-700 dark:text-indigo-300 mb-1; }
            .sidebar-card p { @apply text-xs text-slate-500 dark:text-slate-400; }
            
            .sidebar-toggle-floating { @apply fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-indigo-600/40 z-[100] lg:hidden animate-bounce hover:animate-none hover:scale-110 transition-transform; }

            /* Main Area */
            .main-content { @apply flex-1 ml-72 flex flex-col min-w-0 transition-all duration-300 h-screen overflow-hidden; }
            .main-content.expanded { @apply ml-0; }
            
            /* Top Bar */
            .top-bar { @apply h-[88px] bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-b border-white/20 dark:border-slate-800/50 flex items-center justify-between px-8 sticky top-0 z-40 transition-colors duration-300; }
            .top-bar-left, .top-bar-right { @apply flex items-center gap-4; }
            .top-bar-toggle { @apply w-11 h-11 rounded-full flex items-center justify-center bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-white hover:text-indigo-600 dark:hover:bg-slate-700 dark:hover:text-white hover:shadow-md transition-all; cursor: pointer; }
            
            /* Breadcrumbs */
            .breadcrumb { @apply flex items-center gap-2 text-sm font-medium; }
            .breadcrumb-root { @apply text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors; }
            .breadcrumb-separator { @apply text-slate-300 dark:text-slate-600 font-light; }
            .breadcrumb-current { @apply font-bold text-slate-800 dark:text-white tracking-tight; }
            
            /* Search */
            .search-wrapper { @apply relative flex items-center hidden md:flex; }
            .search-input { @apply w-80 px-4 py-2.5 pl-11 bg-white/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-slate-800 dark:text-white placeholder-slate-400 shadow-inner; }
            .search-icon { @apply absolute left-4 text-slate-400 w-4 h-4; }
            
            .notification-bell { @apply relative w-11 h-11 rounded-full flex items-center justify-center bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-700 transition-all cursor: pointer; }
            
            .user-profile { @apply flex items-center gap-3 px-2 py-1.5 rounded-2xl hover:bg-white/60 dark:hover:bg-slate-800/60 transition-colors cursor: pointer relative border border-transparent hover:border-slate-200 dark:hover:border-slate-700; }
            .user-avatar { @apply w-10 h-10 rounded-xl object-cover bg-slate-200 border border-slate-300 dark:border-slate-600; }
            .user-dropdown { @apply absolute top-full right-0 mt-2 w-56 bg-white dark:bg-slate-800 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl p-2 hidden opacity-0 transition-opacity origin-top-right scale-95; }
            .user-profile:hover .user-dropdown { @apply block opacity-100 scale-100 animate-slide-up; }
            .dropdown-item { @apply flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-indigo-600 dark:hover:text-white transition-colors; }
            .dropdown-item.danger { @apply text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600; }
            
            /* Content Area */
            .content-body { @apply flex-1 p-8 overflow-y-auto custom-scroll opacity-0 animate-fade-in; }
            .tab-content { @apply hidden; }
            .tab-content.active { @apply block; }
            .tab-header-premium { @apply flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4; }
            .header-actions { @apply flex items-center gap-3 w-full md:w-auto; }
            .search-mini { @apply relative flex items-center flex-1 md:flex-none; }
            .search-mini input { @apply w-full md:w-64 px-4 py-2 pl-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none text-slate-800 dark:text-white; }
            .search-mini i { @apply absolute left-3 text-slate-400 w-4 h-4; }
            
            /* Cards & Stats */
            .card { @apply bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700/80 rounded-[1.5rem] p-6 shadow-lg shadow-slate-200/30 dark:shadow-none transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/5 hover:-translate-y-1 mb-6; }
            .stats-grid { @apply grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8; }
            .stat-card { @apply flex flex-col gap-4 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border border-slate-200 dark:border-slate-700/80 rounded-[1.5rem] p-6 shadow-md hover:shadow-xl hover:-translate-y-1 transition-all; }
            .stat-icon-wrapper { @apply w-12 h-12 rounded-xl flex items-center justify-center text-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400; }
            .stat-title { @apply text-sm font-medium text-slate-500 dark:text-slate-400; }
            .stat-value { @apply text-2xl font-bold text-slate-800 dark:text-white tracking-tight; }
            
            /* Buttons */
            .btn { @apply inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all duration-200 active:scale-95 text-sm outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-slate-900 border cursor-pointer whitespace-nowrap; }
            .btn-primary { @apply bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/30 border-white/10 hover:shadow-xl hover:shadow-indigo-500/40 hover:-translate-y-0.5; }
            .btn-outline { @apply bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300 hover:-translate-y-0.5 shadow-sm; }
            
            /* Tables */
            .table-container { @apply overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 backdrop-blur-md; }
            table { @apply w-full text-left border-collapse; }
            th { @apply px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-md whitespace-nowrap; }
            td { @apply px-6 py-4 whitespace-nowrap text-sm text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-700/50 transition-colors; }
            tr:last-child td { @apply border-b-0; }
            tr:hover td { @apply bg-slate-50/50 dark:bg-slate-700/30; }

            /* Modals */
            .modal { @apply fixed inset-0 flex items-center justify-center z-[1000] bg-slate-900/60 dark:bg-black/60 backdrop-blur-sm opacity-0 invisible transition-all duration-300 p-4; }
            .modal[style*="display: block"], .modal[style*="display: flex"] { @apply opacity-100 visible; }
            
            .modal-content { @apply bg-white dark:bg-slate-800 w-full max-w-2xl max-h-[90vh] rounded-[2rem] shadow-2xl flex flex-col overflow-hidden scale-95 transition-all duration-300 border border-slate-200 dark:border-slate-700 transform origin-center; }
            .modal[style*="display: block"] .modal-content, .modal[style*="display: flex"] .modal-content { @apply scale-100 animate-slide-up; }
            .modal-content.large { @apply max-w-4xl; }
            .modal-content.large-xl { @apply max-w-[1200px]; }
            
            .modal-header { @apply flex items-center justify-between px-8 py-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 shrink-0 sticky top-0 z-10; }
            .modal-header h3 { @apply text-xl flex items-center gap-3 text-slate-800 dark:text-white font-bold; }
            
            .modal-body { @apply p-8 overflow-y-auto custom-scroll flex-1 relative; }
            
            .modal-footer { @apply flex items-center justify-end gap-3 px-8 py-5 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 shrink-0 sticky bottom-0 z-10; }
            
            /* Form Elements */
            .form-grid { @apply grid grid-cols-1 md:grid-cols-2 gap-6; }
            .form-section-header { @apply flex justify-between items-center mb-4 mt-6 border-b border-slate-200 dark:border-slate-700 pb-2; }
            .form-section-header h4 { @apply text-lg font-bold text-slate-800 dark:text-white; }
            
            .form-group { @apply flex flex-col gap-2; }
            .form-group.span-half { @apply col-span-1; }
            .form-group.span-full { @apply col-span-1 md:col-span-2; }
            
            .form-label { @apply text-sm font-semibold text-slate-700 dark:text-slate-300; }
            .form-input, .form-select, .form-input textarea { @apply w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-slate-800 dark:text-white placeholder-slate-400 hover:border-slate-300 dark:hover:border-slate-600 shadow-sm appearance-none; }
            
            /* Input Group with Icon */
            .input-with-icon { @apply relative flex items-center; }
            .input-with-icon input { @apply pl-11; }
            .input-with-icon i { @apply absolute left-4 text-slate-400 w-4 h-4; }

            /* Modal Tabs (Inner) */
            .modal-tabs { @apply flex gap-6 px-8 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pt-4 sticky top-0 z-10 overflow-x-auto custom-scroll; }
            .modal-tab { @apply pb-4 font-semibold text-sm text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-white cursor-pointer transition-colors relative whitespace-nowrap; }
            .modal-tab.active { @apply text-indigo-600 dark:text-indigo-400; }
            .modal-tab.active::after { content:''; @apply absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 dark:bg-indigo-400 rounded-t-md; }
            .modal-tab-content { @apply hidden pt-6 animate-fade-in; }
            .modal-tab-content.active { @apply block; }
            
            /* Buttons special */
            .btn-close { @apply w-10 h-10 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/20 dark:hover:text-red-400 transition-all focus:outline-none focus:ring-2 focus:ring-red-500; }
            .add-relative-btn { @apply inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer border border-indigo-100; }

            /* CRM Wizard Specs */
            .crm-wizard-modal { @apply h-[95vh] max-h-[1000px]; }
            .crm-wizard-form { @apply flex flex-col h-full; }
            .wizard-header-container { @apply flex flex-col px-8 py-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 shrink-0; }
            .wizard-header-top { @apply flex justify-between items-start mb-6; }
            .wizard-title { @apply text-2xl font-bold flex items-center gap-3 text-slate-800 dark:text-white; }
            .wizard-subtitle { @apply text-sm text-slate-500 dark:text-slate-400 mt-1; }
            
            .stepper-horizontal { @apply flex items-center justify-between w-full max-w-3xl mx-auto; }
            .stepper-item { @apply flex flex-col items-center relative flex-1 z-10 cursor-pointer group; }
            .step-circle { @apply w-12 h-12 rounded-full flex items-center justify-center bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-400 font-bold transition-all duration-300 shadow-sm group-hover:border-indigo-400; }
            .stepper-item.active .step-circle { @apply border-indigo-600 text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 dark:border-indigo-500 dark:text-indigo-400 shadow-md ring-4 ring-indigo-50 dark:ring-indigo-900/20; }
            .stepper-item.completed .step-circle { @apply border-success bg-success text-white shadow-md; }
            .step-label { @apply mt-2 text-xs font-semibold text-center text-slate-500 transition-colors group-hover:text-indigo-500; }
            .stepper-item.active .step-label { @apply text-indigo-700 dark:text-indigo-400 font-bold; }
            .stepper-item.completed .step-label { @apply text-success; }
            .step-line { @apply absolute top-6 left-1/2 w-full h-[2px] bg-slate-200 dark:bg-slate-700 -z-10 transition-colors duration-300; }
            .stepper-item.completed:not(:last-child) .step-line { @apply bg-success; }
            .stepper-item:last-child .step-line { @apply hidden; }

            .beneficiary-modal-body { @apply flex-1 p-8 overflow-y-auto bg-white dark:bg-slate-800; }
            
            /* Modern Grid Layouts Inside Modals */
            .modern-section-title { @apply pb-3 mb-6 border-b border-slate-200 dark:border-slate-700 text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2; }
            .modern-form-grid { @apply grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6; }
            .modern-label { @apply text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 block; }
            
            .modern-sub-section { @apply mb-8 bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-700; }
            .section-flex-header { @apply flex justify-between items-center mb-5 pb-3 border-b border-slate-200 dark:border-slate-700; }
            .section-flex-header h5 { @apply flex items-center gap-2 font-bold text-slate-700 dark:text-slate-200; }
            
            /* Custom Switch (Toggles) */
            .modern-switch-card { @apply flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm hover:shadow-md transition-shadow; }
            .modern-switch-card h5 { @apply font-bold text-sm text-slate-800 dark:text-white; }
            .modern-switch-card p { @apply text-xs text-slate-500 dark:text-slate-400 mt-0.5; }
            
            .modern-switch { @apply relative inline-block w-12 h-6 cursor-pointer; }
            .modern-switch input { @apply opacity-0 w-0 h-0; }
            .modern-slider { @apply absolute inset-0 bg-slate-200 dark:bg-slate-600 rounded-full transition-colors duration-300 before:absolute before:content-[''] before:h-4 before:w-4 before:left-1 before:bottom-1 before:bg-white before:rounded-full before:transition-transform before:duration-300; }
            .modern-switch input:checked + .modern-slider { @apply bg-indigo-600; }
            .modern-switch input:checked + .modern-slider:before { @apply translate-x-6; }
            
            .modern-modal-footer { @apply flex items-center px-8 py-5 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 shrink-0 sticky bottom-0; }
            
            /* Scrollbar */
            .custom-scroll::-webkit-scrollbar { w-2 h-2 }
            .custom-scroll::-webkit-scrollbar-track { @apply bg-transparent; }
            .custom-scroll::-webkit-scrollbar-thumb { @apply bg-slate-300 dark:bg-slate-600 rounded-full border-2 border-solid border-transparent bg-clip-padding hover:bg-slate-400 dark:hover:bg-slate-500; }
            
            /* Detailed View Grid */
            .detail-grid { @apply grid grid-cols-1 md:grid-cols-2 gap-4; }
            .detail-item { @apply flex flex-col gap-1 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700; }
            .detail-label { @apply text-xs font-semibold text-slate-500 uppercase tracking-wider; }
            .detail-value { @apply font-medium text-slate-800 dark:text-white text-sm; }
        }
    </style>
    """

    # Replace the stylesheet link with our tailwind block
    html = re.sub(r'<link\s+rel="stylesheet"\s+href="css/style\.css">', tailwind_setup, html)
    
    with open('public/dashboard.html', 'w', encoding='utf-8') as f:
        f.write(html)

if __name__ == "__main__":
    redesign()
