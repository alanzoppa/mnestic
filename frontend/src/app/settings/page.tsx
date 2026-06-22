'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Key, Plus, Trash2, AlertTriangle, Copy, X, Check, Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { CopyButton } from '@/components/ui/CopyButton';
import { SectionHeader } from '@/components/ui/SectionHeader';
import {
  listApiTokens,
  createApiToken,
  revokeApiToken,
  type ApiToken,
} from '@/lib/api';

const tokenKeys = {
  all: ['api-tokens'] as const,
};

function formatDate(iso: string | null): string {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [newTokenName, setNewTokenName] = useState('');
  const [createdToken, setCreatedToken] = useState('');
  const [confirmRevoke, setConfirmRevoke] = useState<number | null>(null);

  const {
    data: tokensData,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: tokenKeys.all,
    queryFn: listApiTokens,
  });

  const tokens = tokensData?.tokens ?? [];

  const createMutation = useMutation({
    mutationFn: createApiToken,
    onSuccess: (result) => {
      setCreatedToken(result.token);
      setNewTokenName('');
      queryClient.invalidateQueries({ queryKey: tokenKeys.all });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: revokeApiToken,
    onSuccess: () => {
      setConfirmRevoke(null);
      queryClient.invalidateQueries({ queryKey: tokenKeys.all });
    },
  });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newTokenName.trim()) return;
    createMutation.mutate(newTokenName.trim());
  }

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Settings"
        description="Manage authentication and API tokens"
        accent
      />

      {/* Create token card */}
      <Card className="animate-fade-up">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
              <Key className="w-5 h-5" />
            </div>
            <CardTitle>API Tokens</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-3">
            <Input
              label="Token name"
              placeholder="e.g. Homepage widget, Personal laptop"
              value={newTokenName}
              onChange={(e) => setNewTokenName(e.target.value)}
              className="flex-1"
              data-testid="token-name-input"
            />
            <Button
              type="submit"
              variant="primary"
              className="sm:self-end sm:mb-[1.35rem]"
              loading={createMutation.isPending}
              disabled={!newTokenName.trim() || createMutation.isPending}
              data-testid="create-token-button"
            >
              <Plus className="w-4 h-4" />
              Create Token
            </Button>
          </form>

          {createdToken && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 space-y-3 animate-scale-in">
              <div className="flex items-start gap-2 text-amber-400">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium">Copy this key now</p>
                  <p className="text-sm text-amber-300/80">
                    It will not be shown again after you leave this page.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 break-all font-mono">
                  {createdToken}
                </code>
                <CopyButton text={createdToken} className="shrink-0" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCreatedToken('')}
                  aria-label="Dismiss new token"
                  className="shrink-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {isError && (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              Could not load tokens: {error?.message || 'unknown error'}
            </div>
          )}

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-16 rounded-lg bg-zinc-900/60 border border-zinc-800/60 animate-pulse" />
              ))}
            </div>
          ) : tokens.length === 0 ? (
            <div className="text-center py-10 text-zinc-500 border border-dashed border-zinc-800 rounded-lg">
              <Key className="w-8 h-8 mx-auto mb-3 opacity-50" />
              <p>No API tokens yet.</p>
            </div>
          ) : (
            <div className="border border-zinc-800 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-zinc-900/60 text-zinc-400 border-b border-zinc-800">
                      <th className="text-left px-4 py-3 font-medium">Name</th>
                      <th className="text-left px-4 py-3 font-medium">Prefix</th>
                      <th className="text-left px-4 py-3 font-medium">Created</th>
                      <th className="text-left px-4 py-3 font-medium">Last used</th>
                      <th className="text-left px-4 py-3 font-medium">Status</th>
                      <th className="text-right px-4 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {tokens.map((token) => (
                      <TokenRow
                        key={token.id}
                        token={token}
                        confirmRevoke={confirmRevoke}
                        onRequestRevoke={setConfirmRevoke}
                        onRevoke={(id) => revokeMutation.mutate(id)}
                        isRevoking={revokeMutation.isPending}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface TokenRowProps {
  token: ApiToken;
  confirmRevoke: number | null;
  onRequestRevoke: (id: number | null) => void;
  onRevoke: (id: number) => void;
  isRevoking: boolean;
}

function TokenRow({ token, confirmRevoke, onRequestRevoke, onRevoke, isRevoking }: TokenRowProps) {
  const isConfirming = confirmRevoke === token.id;

  return (
    <tr className={token.revoked ? 'opacity-50' : ''}>
      <td className="px-4 py-3 font-medium text-zinc-200">{token.name}</td>
      <td className="px-4 py-3 font-mono text-zinc-400">{token.key_prefix}</td>
      <td className="px-4 py-3 text-zinc-400">{formatDate(token.created_at)}</td>
      <td className="px-4 py-3 text-zinc-400">{formatDate(token.last_used_at)}</td>
      <td className="px-4 py-3">
        {token.revoked ? (
          <Badge variant="zinc" size="sm">Revoked</Badge>
        ) : (
          <Badge variant="green" size="sm">Active</Badge>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        {isConfirming ? (
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="danger"
              size="sm"
              onClick={() => onRevoke(token.id)}
              loading={isRevoking}
              disabled={isRevoking}
            >
              <Check className="w-4 h-4" />
              Confirm
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRequestRevoke(null)}
              disabled={isRevoking}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRequestRevoke(token.id)}
            disabled={token.revoked}
            aria-label={`Revoke token ${token.name}`}
          >
            <Trash2 className="w-4 h-4 text-red-400" />
          </Button>
        )}
      </td>
    </tr>
  );
}
