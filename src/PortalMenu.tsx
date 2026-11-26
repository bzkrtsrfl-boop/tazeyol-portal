import React, { useState } from 'react';
import { Menu, X, ChevronRight, LayoutDashboard } from 'lucide-react';

type Item = {
  id: string;
  label: string;
  badge?: number;
  icon: React.ComponentType<{ className?: string }>;
};

type Group = { id: string; label: string; items: Item[] };

type Depot = { id: string; label: string; count: number };
type RentalG = { id: string; label: string; count: number };

type Props = {
  brand: React.ReactNode;
  canOverview: boolean;
  activeTab: string;
  filoDepot: string;
  rentalWorkGroup: string;
  sidebarGroups: Group[];
  filoMenus: Depot[];
  rentalMenus: RentalG[];
  onHome: () => void;
  onNavigate: (id: string, extra?: { filoDepot?: string; rentalGroup?: string }) => void;
};

/** Menü aç/kapa ve gruplar burada; tıklayınca tüm portal yeniden çizilmez. */
export default function PortalMenu({
  brand,
  canOverview,
  activeTab,
  filoDepot,
  rentalWorkGroup,
  sidebarGroups,
  filoMenus,
  rentalMenus,
  onHome,
  onNavigate
}: Props) {
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<Record<string, boolean>>({});
  const [filoOpen, setFiloOpen] = useState(true);
  const [rentalOpen, setRentalOpen] = useState(true);

  const go = (id: string, extra?: { filoDepot?: string; rentalGroup?: string }) => {
    setOpen(false);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => onNavigate(id, extra));
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition flex items-center gap-2 font-bold text-xs shadow-sm"
      >
        <Menu className="w-5 h-5 text-[#009fe3]" />
        <span>MENÜ</span>
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex">
          <div onClick={() => setOpen(false)} className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" />
          <div className="relative w-80 bg-white h-full shadow-2xl flex flex-col z-10 portal-drawer">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  requestAnimationFrame(() => {
                    requestAnimationFrame(() => onHome());
                  });
                }}
                className="text-left"
                title="Ana ekran"
              >
                {brand}
              </button>
              <button type="button" onClick={() => setOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="p-3 space-y-3 flex-1 overflow-y-auto text-xs">
              {canOverview && (
                <button
                  type="button"
                  onClick={() => go('overview')}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl font-semibold ${activeTab === 'overview' ? 'bg-blue-50 text-[#009fe3] font-bold border border-blue-200' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <LayoutDashboard className={`w-4 h-4 ${activeTab === 'overview' ? 'text-[#009fe3]' : 'text-slate-400'}`} />
                  Genel görünüm
                </button>
              )}
              {sidebarGroups.map(group => {
                const inThis = group.items.some(i => i.id === activeTab);
                const groupOpen = groups[group.id] ?? inThis;
                return (
                  <div key={group.id}>
                    <button
                      type="button"
                      onClick={() => setGroups(prev => ({ ...prev, [group.id]: !groupOpen }))}
                      className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-600"
                    >
                      <span>{group.label}</span>
                      <ChevronRight className={`w-3.5 h-3.5 transition ${groupOpen ? 'rotate-90' : ''}`} />
                    </button>
                    {groupOpen && (
                      <div className="space-y-0.5 mt-0.5">
                        {group.items.map(item => {
                          const Icon = item.icon;
                          const isActive = activeTab === item.id;
                          if (item.id === 'trip_settlements') {
                            return (
                              <div key={item.id} className="space-y-0.5">
                                <button
                                  type="button"
                                  onClick={() => setFiloOpen(!filoOpen)}
                                  className={`w-full flex items-center justify-between p-3 rounded-xl font-semibold ${
                                    isActive ? 'bg-blue-50 text-[#009fe3] font-bold border border-blue-200' : 'text-slate-600 hover:bg-slate-50'
                                  }`}
                                >
                                  <div className="flex items-center gap-3">
                                    <Icon className={`w-4 h-4 ${isActive ? 'text-[#009fe3]' : 'text-slate-400'}`} />
                                    <span>Filo</span>
                                  </div>
                                  <ChevronRight className={`w-4 h-4 transition ${filoOpen ? 'rotate-90' : ''}`} />
                                </button>
                                {filoOpen && filoMenus.map(d => {
                                  const on = isActive && filoDepot === d.id;
                                  return (
                                    <button
                                      key={d.id}
                                      type="button"
                                      onClick={() => go('trip_settlements', { filoDepot: d.id })}
                                      className={`w-full text-left ml-4 px-3 py-2 rounded-lg font-semibold ${on ? 'bg-[#009fe3] text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                                    >
                                      {d.label}
                                      <span className={`float-right text-[10px] ${on ? 'text-white/80' : 'text-slate-400'}`}>{d.count}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            );
                          }
                          if (item.id === 'rental_settlements') {
                            return (
                              <div key={item.id} className="space-y-0.5">
                                <button
                                  type="button"
                                  onClick={() => setRentalOpen(!rentalOpen)}
                                  className={`w-full flex items-center justify-between p-3 rounded-xl font-semibold ${
                                    isActive ? 'bg-blue-50 text-[#009fe3] font-bold border border-blue-200' : 'text-slate-600 hover:bg-slate-50'
                                  }`}
                                >
                                  <div className="flex items-center gap-3">
                                    <Icon className={`w-4 h-4 ${isActive ? 'text-[#009fe3]' : 'text-slate-400'}`} />
                                    <span>Kiralık araçlar</span>
                                  </div>
                                  <ChevronRight className={`w-4 h-4 transition ${rentalOpen ? 'rotate-90' : ''}`} />
                                </button>
                                {rentalOpen && rentalMenus.map(g => {
                                  const on = isActive && rentalWorkGroup === g.id;
                                  return (
                                    <button
                                      key={g.id}
                                      type="button"
                                      onClick={() => go('rental_settlements', { rentalGroup: g.id })}
                                      className={`w-full text-left ml-4 px-3 py-2 rounded-lg font-semibold ${on ? 'bg-[#009fe3] text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                                    >
                                      {g.label}
                                      <span className={`float-right text-[10px] ${on ? 'text-white/80' : 'text-slate-400'}`}>{g.count}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            );
                          }
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => go(item.id)}
                              className={`w-full flex items-center justify-between p-3 rounded-xl font-semibold ${
                                isActive ? 'bg-blue-50 text-[#009fe3] font-bold border border-blue-200' : 'text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <Icon className={`w-4 h-4 ${isActive ? 'text-[#009fe3]' : 'text-slate-400'}`} />
                                <span>{item.label}</span>
                              </div>
                              {item.badge !== undefined && (
                                <span className={`px-2 py-0.5 rounded-full text-[10px] ${isActive ? 'bg-blue-200 text-blue-800' : 'bg-slate-100 text-slate-500'}`}>
                                  {item.badge}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
            <div className="p-4 border-t border-slate-100 bg-slate-50 text-[11px] text-slate-400 text-center">
              Tazeyol ERP v3.2 • Soğuk Zincir Lojistiği
            </div>
          </div>
        </div>
      )}
    </>
  );
}
