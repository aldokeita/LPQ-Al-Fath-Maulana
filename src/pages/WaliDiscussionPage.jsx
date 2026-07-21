
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Calendar, Clock, Video, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';

const WaliDiscussionPage = () => {
    const [discussions, setDiscussions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDiscussions = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('website_content')
                .select('content')
                .eq('key', 'waliDiscussions')
                .single();

            if (error && error.code !== 'PGRST116') {
                toast({ title: "Error", description: "Gagal memuat jadwal diskusi.", variant: "destructive" });
            } else if (data && data.content) {
                const sortedDiscussions = data.content.sort((a, b) => new Date(b.date) - new Date(a.date));
                setDiscussions(sortedDiscussions);
            }
            setLoading(false);
        };
        fetchDiscussions();
    }, []);

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('id-ID', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    return (
        <>
            <Helmet>
                <title>Diskusi Wali Santri - LPQ Al-Fath Maulana</title>
                <meta name="description" content="Jadwal diskusi online untuk wali santri LPQ Al-Fath Maulana." />
            </Helmet>
            <div className="py-20 bg-gray-50 dark:bg-gray-900">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center mb-12"
                    >
                        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
                            Diskusi Wali Santri
                        </h1>
                        <p className="text-xl text-gray-600 dark:text-gray-400">
                            Jadwal pertemuan dan diskusi online bersama guru dan pengurus LPQ.
                        </p>
                    </motion.div>

                    <div className="space-y-8">
                        {loading ? (
                            <p className="text-center">Memuat jadwal...</p>
                        ) : discussions.length > 0 ? (
                            discussions.map((item, index) => (
                                <motion.div
                                    key={item.id}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: index * 0.1 }}
                                >
                                    <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
                                        <CardHeader>
                                            <CardTitle className="text-2xl text-primary">{item.title}</CardTitle>
                                            <CardDescription className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2">
                                                <span className="flex items-center gap-2"><Calendar className="w-4 h-4"/>{formatDate(item.date)}</span>
                                                <span className="flex items-center gap-2"><Clock className="w-4 h-4"/>{item.time} WIB</span>
                                                <span className="flex items-center gap-2"><Video className="w-4 h-4"/>{item.platform}</span>
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="mb-4">{item.description}</p>
                                            <Button asChild>
                                                <a href={item.link} target="_blank" rel="noopener noreferrer">
                                                    Gabung Diskusi
                                                </a>
                                            </Button>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            ))
                        ) : (
                            <Card className="text-center py-12">
                                <CardHeader>
                                    <CardTitle>Belum Ada Jadwal</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-muted-foreground">Jadwal diskusi akan segera diumumkan. Silakan cek kembali nanti.</p>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default WaliDiscussionPage;
