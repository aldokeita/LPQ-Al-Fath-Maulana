import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/localDatabase';

const CallToAction = () => {
    const [backgroundUrl, setBackgroundUrl] = useState('');
    const [opacity, setOpacity] = useState(0.5);

    useEffect(() => {
        const fetchContent = () => {
            const { data } = db.query('website_content', item => ['ctaBackgroundUrl', 'ctaBackgroundOverlayOpacity'].includes(item.key));
            const contentMap = data.reduce((acc, item) => {
                acc[item.key] = item.content;
                return acc;
            }, {});

            setBackgroundUrl(contentMap.ctaBackgroundUrl || 'https://images.unsplash.com/photo-1584467735871-8e85353a8413?q=80&w=2070&auto=format&fit=crop');
            setOpacity(parseFloat(contentMap.ctaBackgroundOverlayOpacity) || 0.5);
        };
        fetchContent();
        // Removed realtime subscription for local version
    }, []);

    return (
        <section className="relative py-24 sm:py-32 bg-gray-800 text-white overflow-hidden">
            <div
                className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-all duration-1000"
                style={{ backgroundImage: `url(${backgroundUrl})` }}
            ></div>
            <div
                className="absolute inset-0 bg-black transition-opacity duration-300"
                style={{ opacity: opacity }}
            ></div>
            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                <motion.div
                    initial={{ opacity: 0, y: 50 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.5 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                >
                    <h2 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl font-cinzel">
                        Bergabung Bersama Kami
                    </h2>
                    <p className="mt-6 max-w-2xl mx-auto text-lg sm:text-xl text-gray-300">
                        Membentuk generasi Qur'ani yang cerdas, berakhlak mulia, dan siap menjadi pemimpin masa depan.
                    </p>
                    <div className="mt-10 max-w-sm mx-auto sm:max-w-none sm:flex sm:justify-center space-y-4 sm:space-y-0 sm:space-x-4">
                        <Button asChild size="lg" className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground text-lg">
                            <Link to="/pendaftaran/informasi">Daftar Sekarang</Link>
                        </Button>
                        <Button asChild size="lg" variant="outline" className="w-full sm:w-auto text-lg border-white text-white hover:bg-white hover:text-gray-800">
                            <Link to="/kontak">Hubungi Kami</Link>
                        </Button>
                    </div>
                </motion.div>
            </div>
        </section>
    );
};

export default CallToAction;