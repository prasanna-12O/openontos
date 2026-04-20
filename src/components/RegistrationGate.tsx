import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Lock } from 'lucide-react';

interface RegistrationGateProps {
  variant: 'soft' | 'hard';
  onDismiss?: () => void;
  onCancel?: () => void;
}

export default function RegistrationGate({ variant, onDismiss, onCancel }: RegistrationGateProps) {
  const navigate = useNavigate();

  if (variant === 'soft') {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="mb-6 p-4 rounded-xl bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/30 flex items-center gap-3"
      >
        <Sparkles className="w-5 h-5 text-primary shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium">Enjoying OpenOntos?</p>
          <p className="text-xs text-muted-foreground">
            Register with your email to unlock unlimited projects. It's quick and free.
          </p>
        </div>
        <button
          onClick={() => navigate('/auth')}
          className="px-4 py-2 gradient-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90 transition-opacity"
        >
          Register
        </button>
        <button onClick={onDismiss} className="p-1 hover:bg-muted rounded transition-colors">
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </motion.div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-6"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-md w-full bg-card border border-border rounded-2xl p-8 glow-primary"
        >
          <div className="w-14 h-14 rounded-2xl gradient-primary mx-auto mb-4 flex items-center justify-center glow-primary">
            <Lock className="w-7 h-7 text-primary-foreground" />
          </div>
          <h2 className="text-xl font-bold text-center mb-2">Register to continue</h2>
          <p className="text-sm text-muted-foreground text-center mb-6">
            You've created 2 projects already. Please register with your email to create more —
            it's free and takes less than a minute.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/auth')}
              className="flex-1 px-5 py-2.5 gradient-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity glow-primary"
            >
              Register now
            </button>
            <button
              onClick={onCancel}
              className="px-5 py-2.5 bg-secondary text-secondary-foreground rounded-lg text-sm hover:bg-secondary/80 transition-colors"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
