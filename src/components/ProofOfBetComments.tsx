import React, { useState } from 'react';
import { Comment, User } from '../types';
import { api } from '../api';
import {
  MessageSquare,
  ThumbsUp,
  ShieldCheck,
  Send,
  Lock,
  Sparkles,
  AlertCircle,
} from 'lucide-react';

interface ProofOfBetCommentsProps {
  temkaId: string;
  comments: Comment[];
  currentUser: User | null;
  hasUserDeposited: boolean;
  userStats: any;
  onCommentsUpdated: () => void;
  onViewAuthor?: (userId: string) => void;
}

export const ProofOfBetComments: React.FC<ProofOfBetCommentsProps> = ({
  temkaId,
  comments,
  currentUser,
  hasUserDeposited,
  userStats,
  onCommentsUpdated,
  onViewAuthor,
}) => {
  const [text, setText] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'likes'>('date');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setError(null);
    setSubmitting(true);

    try {
      await api.postComment(temkaId, text);
      setText('');
      onCommentsUpdated();
    } catch (err: any) {
      setError(err.message || 'Ошибка публикации отзыва');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLike = async (commentId: string) => {
    if (!currentUser) {
      setError('Войдите в аккаунт, чтобы ставить лайки.');
      return;
    }
    if (!hasUserDeposited) {
      setError('Ставить лайки могут только игроки, совершившие хотя бы один депозит в эту темку.');
      return;
    }

    try {
      await api.likeComment(temkaId, commentId);
      onCommentsUpdated();
    } catch (err: any) {
      setError(err.message || 'Ошибка отметки лайка');
    }
  };

  // Sort comments client side
  const sortedComments = [...comments].sort((a, b) => {
    if (sortBy === 'likes') {
      return b.likes.length - a.likes.length;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              Отзывы и обсуждение темки
              <span className="text-xs px-2.5 py-0.5 bg-neutral-800 text-amber-400 rounded-full font-mono font-bold">
                {comments.length}
              </span>
            </h3>
            <p className="text-xs text-neutral-400">
              Мнения реальных инвесторов с верифицированной статистикой депозитов и доходности
            </p>
          </div>
        </div>

        {/* Sort toggle */}
        <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-xl border border-neutral-800 text-xs">
          <button
            onClick={() => setSortBy('date')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              sortBy === 'date'
                ? 'bg-neutral-800 text-amber-300 shadow-xs'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Свежие
          </button>
          <button
            onClick={() => setSortBy('likes')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              sortBy === 'likes'
                ? 'bg-neutral-800 text-amber-300 shadow-xs'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            По лайкам 🔥
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-950/50 border border-rose-800/80 rounded-xl flex items-start gap-2.5 text-xs text-rose-200">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Post Comment Form */}
      <div>
        {currentUser ? (
          hasUserDeposited ? (
            <form onSubmit={handleSubmit} className="space-y-3 bg-neutral-950/80 border border-neutral-800/80 rounded-2xl p-4">
              <div>
                <textarea
                  rows={2}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Оставьте отзыв о работе алгоритма темки, доходности или пуле ликвидности..."
                  className="w-full bg-neutral-900 border border-neutral-700/80 rounded-xl p-3 text-sm text-white placeholder:text-neutral-500 focus:outline-hidden focus:border-amber-500 transition-colors resize-none"
                />
              </div>

              {/* User Verified Badge Preview */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-neutral-400 bg-neutral-900 px-3 py-1.5 rounded-xl border border-neutral-800">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Ваша статистика:</span>
                  <span className="font-mono text-neutral-200">
                    Ставки ~{userStats?.roundedTotalBets?.toLocaleString()} ₽
                  </span>
                  <span className="text-neutral-600">|</span>
                  <span
                    className={`font-mono font-bold ${
                      userStats?.colorCode === 'green'
                        ? 'text-emerald-400'
                        : userStats?.colorCode === 'red'
                        ? 'text-rose-400'
                        : 'text-neutral-400'
                    }`}
                  >
                    ROI: {userStats?.exactRoiMultiplier}x
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={submitting || !text.trim()}
                  className="flex items-center justify-center gap-2 px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-bold rounded-xl transition-all disabled:opacity-50 cursor-pointer shadow-md self-end"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{submitting ? 'Публикация...' : 'Опубликовать отзыв'}</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="p-4 bg-neutral-950/80 border border-neutral-800 rounded-2xl flex items-center gap-3 text-xs text-neutral-400">
              <Lock className="w-5 h-5 text-amber-400 shrink-0" />
              <span>
                <strong>Отзывы доступны инвесторам:</strong> чтобы оставить отзыв или поставить лайк,
                сделайте хотя бы одну ставку в этот смарт-контракт.
              </span>
            </div>
          )
        ) : (
          <div className="p-4 bg-neutral-950/80 border border-neutral-800 rounded-2xl text-xs text-neutral-400 text-center">
            Войдите в аккаунт и сделайте ставку, чтобы оставить отзыв в обсуждении темки.
          </div>
        )}
      </div>

      {/* Comments List */}
      <div className="space-y-3 pt-2">
        {sortedComments.length === 0 ? (
          <div className="text-center py-10 text-xs text-neutral-500 bg-neutral-950/40 rounded-2xl border border-neutral-800/40">
            Здесь пока нет отзывов. Сделайте депозит и поделитесь первым мнением о схеме!
          </div>
        ) : (
          sortedComments.map((comment) => {
            const hasLiked = currentUser && comment.likes.includes(currentUser.id);
            const badgeColor =
              comment.userStats.colorCode === 'green'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : comment.userStats.colorCode === 'red'
                ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                : 'bg-neutral-800 text-neutral-400 border-neutral-700';

            return (
              <div
                key={comment.id}
                className="bg-neutral-950/70 border border-neutral-800/80 rounded-2xl p-4 transition-all hover:border-neutral-700"
              >
                {/* Author Info + Verified Badge */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => onViewAuthor?.(comment.userId)}
                      className="flex items-center gap-2 text-left hover:opacity-85 transition-opacity cursor-pointer group"
                      title={`Открыть профиль @${comment.username}`}
                    >
                      {comment.userAvatarUrl ? (
                        <img
                          src={comment.userAvatarUrl}
                          alt={comment.username}
                          className="w-7 h-7 rounded-full object-cover ring-1 ring-amber-500/40"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-neutral-800 text-amber-400 flex items-center justify-center text-xs font-bold ring-1 ring-neutral-700">
                          {comment.username.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <span className="text-xs font-bold text-white font-mono group-hover:text-amber-300 transition-colors underline-offset-2 group-hover:underline">
                        @{comment.username}
                      </span>
                    </button>
                    <span className="text-[11px] text-neutral-500">
                      {new Date(comment.createdAt).toLocaleDateString()}{' '}
                      {new Date(comment.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  {/* Investor Verified Stats Badge */}
                  <div
                    className={`inline-flex items-center gap-2 px-3 py-1 rounded-xl border text-[11px] font-mono ${badgeColor}`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                    <span>Депозиты: ~{comment.userStats.roundedTotalBets.toLocaleString()} ₽</span>
                    <span className="opacity-40">|</span>
                    <span>Выплаты: ~{comment.userStats.roundedTotalPayouts.toLocaleString()} ₽</span>
                    <span className="opacity-40">|</span>
                    <strong className="font-bold">
                      ROI {comment.userStats.exactRoiMultiplier}x
                    </strong>
                  </div>
                </div>

                {/* Comment Text */}
                <p className="text-sm text-neutral-200 leading-relaxed mb-3 pl-1">
                  {comment.text}
                </p>

                {/* Likes Button */}
                <div className="flex items-center gap-3 text-xs pt-1 border-t border-neutral-900">
                  <button
                    onClick={() => handleLike(comment.id)}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                      hasLiked
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-neutral-200 hover:border-neutral-700'
                    }`}
                  >
                    <ThumbsUp className={`w-3.5 h-3.5 ${hasLiked ? 'fill-amber-400' : ''}`} />
                    <span>Полезно ({comment.likes.length})</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
