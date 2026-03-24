import { useState } from 'react';
import { saveApiKey } from '../lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface Props {
  onSave: () => void;
}

export function ApiKeyModal({ onSave }: Props) {
  const [value, setValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    saveApiKey(value.trim());
    onSave();
  };

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-sm" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>API Key required</DialogTitle>
          <DialogDescription>
            Enter your API key to access the Cache Warmer dashboard.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 pt-2">
          <Input
            type="password"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Enter API key"
          />
          <Button type="submit" disabled={!value.trim()}>
            Save
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
