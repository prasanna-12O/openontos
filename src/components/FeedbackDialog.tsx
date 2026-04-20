import { useState } from 'react';
import { MessageSquareHeart, Bug, ExternalLink, Star, X, Code2, Loader2, CheckCircle2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

const GITHUB_ISSUES_URL = 'https://github.com/venuamancha1/openontos-d9628745/issues';
const GITHUB_DISCUSSIONS_URL = 'https://github.com/venuamancha1/openontos-d9628745/discussions';
const APP_VERSION = 'v0.1.0-alpha';

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant?: 'soft' | 'manual';
}

export default function FeedbackDialog({ open, onOpenChange, variant = 'manual' }: FeedbackDialogProps) {
  const isSoft = variant === 'soft';
  const { user, profile } = useAuth();
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const reset = () => {
    setRating(0);
    setHoverRating(0);
    setComment('');
    setSubmitted(false);
    setSubmitting(false);
  };

  const handleClose = (next: boolean) => {
    if (!next) setTimeout(reset, 250);
    onOpenChange(next);
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      toast({ title: 'Pick a rating', description: 'Tap 1–5 stars to rate your experience.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from('feedback').insert({
      user_id: user?.id ?? null,
      email: user?.email ?? null,
      name: profile?.name ?? null,
      rating,
      comment: comment.trim() || null,
      page: typeof window !== 'undefined' ? window.location.pathname : null,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 500) : null,
      app_version: APP_VERSION,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: 'Could not send feedback', description: error.message, variant: 'destructive' });
      return;
    }
    setSubmitted(true);
    setTimeout(() => handleClose(false), 1600);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center glow-primary shrink-0">
              <MessageSquareHeart className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <DialogTitle className="text-lg">
                {submitted ? 'Thank you!' : isSoft ? 'Loving OpenOntos so far?' : 'Share your feedback'}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {submitted
                  ? 'Your feedback has been recorded. We read every one.'
                  : isSoft
                  ? 'You just deployed a pipeline — nice work! Rate it in one tap.'
                  : 'Rate your experience in one tap. Comment optional.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {submitted ? (
          <div className="flex flex-col items-center py-6">
            <CheckCircle2 className="w-12 h-12 text-success mb-2" />
            <p className="text-sm text-muted-foreground">Closing…</p>
          </div>
        ) : (
          <>
            {/* Star rating */}
            <div className="flex flex-col items-center gap-2 py-3">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => {
                  const active = (hoverRating || rating) >= n;
                  return (
                    <button
                      key={n}
                      type="button"
                      onMouseEnter={() => setHoverRating(n)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => setRating(n)}
                      className="p-1.5 rounded-md hover:bg-primary/10 transition-colors"
                      aria-label={`Rate ${n} star${n > 1 ? 's' : ''}`}
                    >
                      <Star
                        className={`w-7 h-7 transition-all ${
                          active ? 'fill-primary text-primary scale-110' : 'text-muted-foreground/40'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground font-mono uppercase tracking-wider min-h-[14px]">
                {rating === 0 && hoverRating === 0 && 'Tap to rate'}
                {(hoverRating || rating) === 1 && '😞 Needs work'}
                {(hoverRating || rating) === 2 && '😕 Could be better'}
                {(hoverRating || rating) === 3 && '🙂 It\'s okay'}
                {(hoverRating || rating) === 4 && '😊 Pretty good'}
                {(hoverRating || rating) === 5 && '🤩 Love it!'}
              </p>
            </div>

            {/* Optional comment */}
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Anything specific? (optional)"
              maxLength={1000}
              rows={3}
              className="resize-none text-sm"
            />
            <div className="flex justify-between items-center -mt-2">
              <span className="text-[10px] text-muted-foreground font-mono">
                {comment.length}/1000
              </span>
              <Button
                onClick={handleSubmit}
                disabled={submitting || rating === 0}
                size="sm"
                className="gradient-primary"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Sending…
                  </>
                ) : (
                  'Send feedback'
                )}
              </Button>
            </div>

            {/* GitHub secondary actions */}
            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-border">
              <a
                href={GITHUB_DISCUSSIONS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-2.5 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-all group"
              >
                <Star className="w-3.5 h-3.5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold flex items-center gap-1">
                    Discuss on GitHub
                    <ExternalLink className="w-2.5 h-2.5 opacity-50 group-hover:opacity-100" />
                  </div>
                </div>
              </a>
              <a
                href={GITHUB_ISSUES_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-2.5 rounded-lg border border-border hover:border-destructive/50 hover:bg-destructive/5 transition-all group"
              >
                <Bug className="w-3.5 h-3.5 text-destructive shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold flex items-center gap-1">
                    Report a bug
                    <ExternalLink className="w-2.5 h-2.5 opacity-50 group-hover:opacity-100" />
                  </div>
                </div>
              </a>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono">
                <Code2 className="w-3 h-3" />
                YOUR VOICE MATTERS
              </div>
              <Button variant="ghost" size="sm" onClick={() => handleClose(false)} className="text-xs h-7">
                <X className="w-3 h-3 mr-1" /> Maybe later
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export { GITHUB_ISSUES_URL, GITHUB_DISCUSSIONS_URL };
