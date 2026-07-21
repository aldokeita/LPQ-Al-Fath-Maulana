import React from 'react';

const VisitorStats = () => {
    return (
        <div className="bg-card p-6 rounded-2xl shadow-xl flex items-center justify-center min-h-[300px]">
            <div className="text-center text-muted-foreground">
                <h3 className="text-xl font-bold mb-2">Fitur Dipindahkan</h3>
                <p>Statistik pengunjung kini telah ditingkatkan dan diganti menjadi "Log Login".</p>
                <p>Silakan cek tab "Log Login" untuk melihat aktivitas pengguna.</p>
            </div>
        </div>
    );
};

export default VisitorStats;