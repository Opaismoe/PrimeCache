import { SectionHeader } from '@/components/ui/section-header';
import type { Group } from '@/lib/types';
import { GroupForm } from '../GroupForm';
import { WebhooksTab } from './WebhooksTab';

interface SettingsTabProps {
  group: Group;
  groupName: string;
  onSave: (updated: Group) => Promise<void>;
  onCancel: () => void;
}

export function SettingsTab({ group, groupName, onSave, onCancel }: SettingsTabProps) {
  return (
    <div className="space-y-10">
      <GroupForm initial={group} onSave={onSave} onCancel={onCancel} />

      <div>
        <SectionHeader
          title="Webhooks"
          hint="Inbound webhook tokens that trigger a warm run for this group."
        />
        <WebhooksTab groupName={groupName} />
      </div>
    </div>
  );
}
