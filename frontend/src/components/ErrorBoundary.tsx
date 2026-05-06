'use client';

import { Component, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './ui/Button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6">
          <div className="card max-w-md w-full p-8 text-center animate-fade-up">
            <div className="relative mb-6">
              <div className="absolute inset-0 blur-2xl opacity-15 bg-red-500/20 rounded-full scale-[2]" />
              <div className="relative w-20 h-20 mx-auto flex items-center justify-center rounded-2xl bg-zinc-900/80 border border-red-500/20 text-red-400">
                <AlertTriangle className="w-9 h-9" strokeWidth={1.5} />
              </div>
            </div>
            <h2 className="text-2xl font-extrabold text-zinc-100 tracking-tight mb-3">
              Something went wrong
            </h2>
            <p className="text-sm text-zinc-400 leading-relaxed mb-6">
              {this.state.error?.message || 'An unexpected error occurred. Try reloading the page.'}
            </p>
            <Button variant="primary" onClick={() => window.location.reload()}>
              Reload page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
