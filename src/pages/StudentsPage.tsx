import React from 'react';
import { StudentSection } from '../components/public/StudentSection';
import { GraduationCap } from 'lucide-react';

export const StudentsPage: React.FC = () => {
  const campuses = [
    { name: 'PDPU / PDEU (Raisan)', desc: 'Direct hostel gate drops at 12:15 PM & 7:45 PM' },
    { name: 'DA-IICT (Sector 9)', desc: 'Gate delivery tailored around lab & lecture breaks' },
    { name: 'GNLU (Koba)', desc: 'Law school exam specials with extra Chaas & salad' },
    { name: 'NIFT Gandhinagar (Sector 25)', desc: 'Design hostel deliveries with light, nutritious choices' },
    { name: 'IIT Gandhinagar (Palaj)', desc: 'Campus cluster vans serving student apartments' },
    { name: 'Kudasan & Bhaijipura PG Hubs', desc: 'Over 40+ PG buildings covered with doorstep room drops' }
  ];

  return (
    <div className="py-12 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        <StudentSection />

        {/* Covered University Campuses */}
        <div className="bg-[#FAF8F5] rounded-3xl p-8 sm:p-12 border border-stone-200">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-extrabold uppercase tracking-widest text-[#107048] bg-emerald-100/70 px-3 py-1 rounded-full border border-emerald-200">
              Campus Coverage
            </span>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-stone-900 mt-2">
              Serving Gandhinagar's Premier Colleges & PGs
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {campuses.map((c, idx) => (
              <div key={idx} className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm space-y-2">
                <div className="flex items-center gap-2 text-emerald-700">
                  <GraduationCap className="w-5 h-5" />
                  <h4 className="font-bold text-sm text-stone-900">{c.name}</h4>
                </div>
                <p className="text-xs text-stone-500">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};
