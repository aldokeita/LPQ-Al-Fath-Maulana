import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const jilidOptions = [
  'Pra TK A', 'Pra TK B', 'Pra TK C', 'Jilid 1A', 'Jilid 1B', 'Jilid 1C', 'Jilid 2A', 'Jilid 2B',
  'Jilid 3A', 'Jilid 3B', 'Jilid 4A', 'Jilid 4B', 'Jilid 5A', 'Jilid 5B', 'Jilid 6A', 'Jilid 6B',
  'Al-Qur\'an', 'Ghorib Tajwid', 'Finishing'
];

const JilidPerformanceChart = ({ data }) => {
    const chartData = useMemo(() => {
        if (!data || data.length === 0) return [];

        const monthlyCounts = data.reduce((acc, entry) => {
            const date = new Date(entry.changed_at);
            // Only count "naik jilid" (promotions) for the chart
            if (jilidOptions.indexOf(entry.to_jilid) <= jilidOptions.indexOf(entry.from_jilid)) {
                return acc;
            }

            const month = date.toLocaleString('id-ID', { month: 'short', year: '2-digit' });

            if (!acc[month]) {
                acc[month] = { month, "Jumlah Kenaikan": 0 };
            }
            acc[month]["Jumlah Kenaikan"]++;
            return acc;
        }, {});

        // Ensure we have data for the last 6 months, even if it's 0
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const monthKey = d.toLocaleString('id-ID', { month: 'short', year: '2-digit' });
            if (!monthlyCounts[monthKey]) {
                monthlyCounts[monthKey] = { month: monthKey, "Jumlah Kenaikan": 0 };
            }
        }

        const sortedMonths = Object.keys(monthlyCounts).sort((a, b) => {
            const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
            const [monthA, yearA] = a.split(' ');
            const [monthB, yearB] = b.split(' ');

            const dateA = new Date(parseInt('20' + yearA), monthNames.indexOf(monthA), 1);
            const dateB = new Date(parseInt('20' + yearB), monthNames.indexOf(monthB), 1);

            return dateA - dateB;
        });

        // Get only last 6 months
        const last6MonthsKeys = sortedMonths.slice(-6);

        return last6MonthsKeys.map(key => monthlyCounts[key]);

    }, [data]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Performa Kenaikan Jilid</CardTitle>
                <CardDescription>Jumlah santri yang naik jilid dalam 6 bulan terakhir.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-80 w-full">
                {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" fontSize={12} />
                            <YAxis allowDecimals={false} />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'hsl(var(--background))',
                                    borderColor: 'hsl(var(--border))'
                                }}
                            />
                            <Legend />
                            <Bar dataKey="Jumlah Kenaikan" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                        Tidak ada data kenaikan jilid untuk ditampilkan.
                    </div>
                )}
                </div>
            </CardContent>
        </Card>
    );
};

export default JilidPerformanceChart;
