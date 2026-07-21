
import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from '@/components/ui/use-toast';
import { ChevronLeft, User, Clock, Trash2 } from 'lucide-react';
import ConfirmationDialog from '@/components/ui/confirmation-dialog';

const ForumTopicPage = () => {
  const { topicId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [topic, setTopic] = useState(null);
  const [replies, setReplies] = useState([]);
  const [newReply, setNewReply] = useState('');
  const [loading, setLoading] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', description: '', onConfirm: () => {} });

  const fetchTopicAndReplies = async () => {
    setLoading(true);
    const { data: topicData, error: topicError } = await supabase
      .from('forum_topics')
      .select('*')
      .eq('id', topicId)
      .single();

    if (topicError) {
      toast({ title: 'Error', description: 'Gagal memuat topik.', variant: 'destructive' });
      setLoading(false);
      return;
    }
    setTopic(topicData);

    const { data: repliesData, error: repliesError } = await supabase
      .from('forum_replies')
      .select('*')
      .eq('topic_id', topicId)
      .order('created_at', { ascending: true });

    if (repliesError) {
      toast({ title: 'Error', description: 'Gagal memuat balasan.', variant: 'destructive' });
    } else {
      setReplies(repliesData);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTopicAndReplies();
  }, [topicId]);

  const handlePostReply = async (e) => {
    e.preventDefault();
    if (!newReply.trim()) return;

    if (!user) {
      toast({ title: 'Akses Ditolak', description: 'Anda harus login untuk membalas.', variant: 'destructive' });
      return;
    }

    const { error } = await supabase.from('forum_replies').insert({
      topic_id: topicId,
      content: newReply,
      author_id: user.id,
      author_name: user.nama_lengkap || user.nama || 'Wali Murid',
      author_role: user.role,
    });

    if (error) {
      toast({ title: 'Gagal Mengirim Balasan', description: error.message, variant: 'destructive' });
    } else {
      setNewReply('');
      fetchTopicAndReplies();
    }
  };

  const handleDelete = async (type, id) => {
    const table = type === 'topic' ? 'forum_topics' : 'forum_replies';

    setConfirmDialog({
      isOpen: true,
      title: `Hapus ${type === 'topic' ? 'Topik' : 'Balasan'}`,
      description: `Anda yakin ingin menghapus ${type === 'topic' ? 'topik' : 'balasan'} ini? Tindakan ini tidak dapat dibatalkan.`,
      onConfirm: async () => {
        const { error } = await supabase.from(table).delete().eq('id', id);
        if (error) {
          toast({ title: 'Gagal Menghapus', description: error.message, variant: 'destructive' });
        } else {
          toast({ title: 'Berhasil Dihapus' });
          if (type === 'topic') {
            navigate('/forum');
          } else {
            fetchTopicAndReplies();
          }
        }
      }
    });
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

  if (loading) {
    return <div className="text-center py-20">Memuat...</div>;
  }

  if (!topic) {
    return <div className="text-center py-20">Topik tidak ditemukan.</div>;
  }

  const canDelete = (authorId) => {
    if (!user) return false;
    return user.role === 'admin' || user.id === authorId;
  };

  return (
    <>
      <Helmet>
        <title>{topic.title} - LPQ Al-Fath Maulana</title>
      </Helmet>
      <div className="py-20 bg-gray-50 dark:bg-[#0a1929]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="mb-8">
              <Button asChild variant="ghost">
                <Link to="/forum" className="flex items-center text-primary hover:underline">
                  <ChevronLeft className="w-5 h-5 mr-1" />
                  Kembali ke Forum
                </Link>
              </Button>
            </div>

            <Card className="mb-8 bg-white dark:bg-[#112D4E]">
              <CardContent className="p-6">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">{topic.title}</h1>
                <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-4">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    <span>{topic.author_name} ({topic.author_role})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span>{timeSince(topic.created_at)}</span>
                  </div>
                </div>
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{topic.content}</p>
                {canDelete(topic.author_id) && (
                  <div className="text-right mt-4">
                    <Button variant="destructive" size="sm" onClick={() => handleDelete('topic', topic.id)}>
                      <Trash2 className="w-4 h-4 mr-2" /> Hapus Topik
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-200">Balasan ({replies.length})</h2>
            <div className="space-y-6">
              {replies.map((reply, index) => (
                <motion.div
                  key={reply.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  className="flex items-start gap-4"
                >
                  <Avatar>
                    <AvatarImage />
                    <AvatarFallback>{reply.author_name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <Card className="bg-white dark:bg-[#112D4E]">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-semibold text-gray-800 dark:text-gray-200">{reply.author_name} <span className="text-sm font-normal text-gray-500 dark:text-gray-400">({reply.author_role})</span></p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{timeSince(reply.created_at)}</p>
                        </div>
                        <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{reply.content}</p>
                        {canDelete(reply.author_id) && (
                          <div className="text-right mt-2">
                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete('reply', reply.id)}>
                              <Trash2 className="w-3 h-3 mr-1" /> Hapus
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </motion.div>
              ))}
            </div>

            {user && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-12">
                <h3 className="text-xl font-semibold mb-3 text-gray-800 dark:text-gray-200">Tulis Balasan Anda</h3>
                <form onSubmit={handlePostReply} className="space-y-4">
                  <Textarea
                    placeholder="Ketik balasan Anda di sini..."
                    rows={4}
                    value={newReply}
                    onChange={(e) => setNewReply(e.target.value)}
                  />
                  <Button type="submit">Kirim Balasan</Button>
                </form>
              </motion.div>
            )}
          </motion.div>
        </div>
      </div>
      <ConfirmationDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        description={confirmDialog.description}
      />
    </>
  );
};

export default ForumTopicPage;
