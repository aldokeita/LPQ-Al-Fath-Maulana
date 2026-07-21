import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { X, Sparkles, Gift } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

const BirthdayGreeting = ({ user, type = "Santri" }) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!user?.tanggal_lahir) return;

    const today = new Date();
    const birthDate = new Date(user.tanggal_lahir);

    if (today.getDate() === birthDate.getDate() && today.getMonth() === birthDate.getMonth()) {
      // Check if we already showed it this session/day (optional, but good UX. For now, show on every load as requested "if birthday today")
      setShow(true);

      // Luxurious Confetti Effect
      const duration = 3 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };

      const randomInRange = (min, max) => Math.random() * (max - min) + min;

      const interval = setInterval(function() {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
      }, 250);
    }
  }, [user]);

  if (!show) return null;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ scale: 0.5, y: 50 }}
            animate={{ scale: 1, y: 0 }}
            className="bg-gradient-to-br from-amber-100 via-yellow-50 to-amber-200 dark:from-amber-900 dark:via-black dark:to-amber-950 p-1 rounded-2xl shadow-2xl max-w-lg w-full relative overflow-hidden border-2 border-amber-400"
          >
            {/* Decorative Ornaments */}
            <div className="absolute top-0 left-0 w-24 h-24 bg-[url('https://www.transparenttextures.com/patterns/arabesque.png')] opacity-20"></div>
            <div className="absolute bottom-0 right-0 w-24 h-24 bg-[url('https://www.transparenttextures.com/patterns/arabesque.png')] opacity-20 rotate-180"></div>

            <div className="bg-white/90 dark:bg-black/80 backdrop-blur-md rounded-xl p-8 text-center relative z-10">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShow(false)}
                className="absolute top-2 right-2 text-amber-600 hover:bg-amber-100 hover:text-amber-800 rounded-full"
              >
                <X className="w-5 h-5" />
              </Button>

              <div className="mb-6 relative inline-block">
                <div className="absolute -inset-4 bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300 rounded-full blur-lg opacity-70 animate-pulse"></div>
                <Avatar className="w-32 h-32 border-4 border-amber-400 shadow-xl relative z-10">
                  <AvatarImage src={user.foto_url} className="object-cover" />
                  <AvatarFallback className="text-4xl bg-amber-100 text-amber-800">{user.nama_lengkap?.charAt(0) || user.nama?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-2 -right-2 bg-amber-500 text-white p-2 rounded-full shadow-lg z-20 animate-bounce">
                    <Gift className="w-6 h-6" />
                </div>
              </div>

              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-3xl font-serif font-bold text-amber-700 dark:text-amber-400 mb-2"
              >
                Barakallah Fii Umrik!
              </motion.h2>

              <motion.h3
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-6"
              >
                {user.nama_lengkap || user.nama}
              </motion.h3>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="space-y-4"
              >
                <div className="bg-amber-50 dark:bg-amber-900/30 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
                  <p className="font-arabic text-xl mb-3 text-amber-800 dark:text-amber-300 leading-loose">
                    اللَّهُمَّ طَوِّلْ عُمُورَنَا وَصَحِّحْ أَجْسَادَنَا وَنَوِّرْ قُلُوبَنَا وَثَبِّتْ إِيمَانَنَا وَأَحْسِنْ أَعْمَالَنَا وَوَسِّعْ أَرْزَاقَنَا
                  </p>
                  <p className="text-sm italic text-gray-600 dark:text-gray-400">
                    "Ya Allah, panjangkanlah umur kami, sehatkanlah jasad kami, terangilah hati kami, tetapkanlah iman kami, baikkanlah amalan kami, dan luaskanlah rezeki kami."
                  </p>
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Semoga di usia yang baru ini, {type === 'Guru' ? 'Ustadz/Ustadzah' : 'Ananda'} senantiasa dalam lindungan Allah SWT, semakin bertambah ilmunya, dan menjadi pribadi yang lebih baik lagi. Aamiin.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1 }}
                className="mt-8"
              >
                <Button onClick={() => setShow(false)} className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white px-8 rounded-full shadow-lg">
                  <Sparkles className="w-4 h-4 mr-2" /> Aamiin Ya Rabbal Alamin
                </Button>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default BirthdayGreeting;
