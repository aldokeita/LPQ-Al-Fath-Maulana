
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import { MessageSquare, Plus, User, Clock } from 'lucide-react';

const ForumPage = () => {
  const { user } = useAuth();
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTopic, setNewTopic] = useState({ title: '', content: '' });
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchTopics();
  }, []);

  const fetchTopics = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('forum_topics')
      .select('*, replies:forum_replies(count)')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Error', description: 'Gagal memuat topik forum.', variant: 'destructive' });
    } else {
      setTopics(data.map(t => ({...t, reply_count: t.replies[0]?.count || 0})));
    }
    setLoading(false);
  };

  const handleCreateTopic = async (e) => {
    e.preventDefault();
    if (!newTopic.title || !newTopic.content) {
      toast({ title: 'Input tidak lengkap', description: 'Judul dan isi topik harus diisi.', variant: 'destructive' });
      return;
    }

    if (!user) {
      toast({ title: 'Akses Ditolak', description: 'Anda harus login untuk membuat topik.', variant: 'destructive' });
      return;
    }

    const { error } = await supabase.from('forum_topics').insert({
      title: newTopic.title,
      content: newTopic.content,
      author_id: user.id,
      author_name: user.nama_lengkap || user.nama || 'Wali Murid',
      author_role: user.role,
    });

    if (error) {
      toast({ title: 'Gagal Membuat Topik', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Berhasil!', description: 'Topik baru telah dibuat.' });
      setNewTopic({ title: '', content: '' });
      setIsModalOpen(false);
      fetchTopics();
    }
  };

  const timeSince = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " tahun lalu";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " bulan lalu";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " hari lalu";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " jam lalu";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " menit lalu";
    return Math.floor(seconds) + " detik lalu";
  };

  return (
    <>
      <Helmet>
        <title>Forum Diskusi - LPQ Al-Fath Maulana</title>
        <meta name="description" content="Forum diskusi untuk wali murid, santri, dan guru LPQ Al-Fath Maulana." />
      </Helmet>
      <div className="py-20 bg-gray-50 dark:bg-[#0a1929]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-12">
            <div className="mb-4 sm:mb-0">
              <h1 className="text-4xl md:text-5xl font-bold text-[#112D4E] dark:text-white">Forum Diskusi</h1>
              <p className="text-lg text-gray-600 dark:text-gray-400 mt-2">Tempat berbagi informasi dan berdiskusi antar wali murid.</p>
            </div>
            {user && (
              <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-primary hover:bg-primary/90 w-full sm:w-auto">
                    <Plus className="w-5 h-5 mr-2" /> Buat Topik Baru
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Buat Topik Diskusi Baru</DialogTitle>
                     <DialogDescription>
                        Bagikan pertanyaan atau informasi Anda kepada sesama wali murid, guru, dan santri.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateTopic} className="grid gap-4 py-4">
                    <Input
                      placeholder="Judul Topik"
                      value={newTopic.title}
                      onChange={(e) => setNewTopic({ ...newTopic, title: e.target.value })}
                    />
                    <Textarea
                      placeholder="Apa yang ingin Anda diskusikan?"
                      rows={5}
                      value={newTopic.content}
                      onChange={(e) => setNewTopic({ ...newTopic, content: e.target.value })}
                    />
                    <Button type="submit">Kirim Topik</Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </motion.div>

          <div className="space-y-6">
            {loading ? (
              <p className="text-center">Memuat topik...</p>
            ) : topics.length > 0 ? (
              topics.map((topic, index) => (
                <motion.div
                  key={topic.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.05 }}
                >
                  <Card className="bg-white dark:bg-[#112D4E] hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <Link to={`/forum/${topic.id}`} className="block">
                        <h2 className="text-xl font-semibold text-primary hover:underline mb-2">{topic.title}</h2>
                      </Link>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500 dark:text-gray-400">
                        <div className="flex items-center gap-1.5">
                          <User className="w-4 h-4" />
                          <span>{topic.author_name} ({topic.author_role})</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-4 h-4" />
                          <span>{timeSince(topic.created_at)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <MessageSquare className="w-4 h-4" />
                          <span>{topic.reply_count} balasan</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500">Belum ada topik diskusi. Jadilah yang pertama!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default ForumPage;
