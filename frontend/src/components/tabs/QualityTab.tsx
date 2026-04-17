import { useQuery } from '@tanstack/react-query';
import { TabLoadingSkeleton } from '@/components/TabLoadingSkeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  getGroupAccessibility,
  getGroupBrokenLinks,
  getGroupExportUrl,
  getGroupSeo,
} from '@/lib/api';
import type { QTabValue } from '@/lib/groupDetailSearch';
import { queryKeys } from '@/lib/queryKeys';
import { AccessibilityTab } from './AccessibilityTab';
import { LighthouseTab } from './LighthouseTab';
import { LinksTab } from './LinksTab';
import { SeoTab } from './SeoTab';

function EmptyTab({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

interface QualityTabProps {
  groupName: string;
  activeQtab: QTabValue;
  onQtabChange: (qtab: QTabValue) => void;
  /** URLs for the Lighthouse sub-tab (comes from group config). */
  groupUrls: string[];
}

export function QualityTab({ groupName, activeQtab, onQtabChange, groupUrls }: QualityTabProps) {
  const { data: seo, isLoading: seoLoading } = useQuery({
    queryKey: queryKeys.groups.seo(groupName),
    queryFn: () => getGroupSeo(groupName),
    enabled: activeQtab === 'seo',
  });

  const { data: brokenLinks, isLoading: linksLoading } = useQuery({
    queryKey: queryKeys.groups.brokenLinks(groupName),
    queryFn: () => getGroupBrokenLinks(groupName),
    enabled: activeQtab === 'links',
  });

  const { data: accessibility, isLoading: accessibilityLoading } = useQuery({
    queryKey: queryKeys.groups.accessibility(groupName),
    queryFn: () => getGroupAccessibility(groupName),
    enabled: activeQtab === 'accessibility',
  });

  const showExport = activeQtab === 'seo' || activeQtab === 'links';

  return (
    <Tabs value={activeQtab} onValueChange={(v) => onQtabChange(v as QTabValue)}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <TabsList>
          <TabsTrigger value="seo">SEO</TabsTrigger>
          <TabsTrigger value="links">Links</TabsTrigger>
          <TabsTrigger value="accessibility">Accessibility</TabsTrigger>
          <TabsTrigger value="lighthouse">Lighthouse</TabsTrigger>
        </TabsList>
        {showExport && (
          <a
            href={getGroupExportUrl(groupName, activeQtab)}
            download
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Export CSV
          </a>
        )}
      </div>

      <TabsContent value="seo">
        {seoLoading ? (
          <TabLoadingSkeleton rows={5} cols={4} />
        ) : seo ? (
          <SeoTab data={seo} />
        ) : (
          <EmptyTab>
            No SEO data collected — visits may be failing. Check the Health tab for uptime errors.
          </EmptyTab>
        )}
      </TabsContent>

      <TabsContent value="links">
        {linksLoading ? (
          <TabLoadingSkeleton rows={5} cols={5} />
        ) : brokenLinks ? (
          <LinksTab data={brokenLinks} />
        ) : (
          <EmptyTab>
            No broken link data yet. Enable <code>checkBrokenLinks: true</code> in config and run
            the group.
          </EmptyTab>
        )}
      </TabsContent>

      <TabsContent value="accessibility">
        {accessibilityLoading ? (
          <TabLoadingSkeleton rows={5} cols={5} />
        ) : accessibility && accessibility.urls.length > 0 ? (
          <AccessibilityTab data={accessibility} />
        ) : (
          <EmptyTab>
            No accessibility data yet. Enable <code>checkAccessibility: true</code> in config and
            run the group.
          </EmptyTab>
        )}
      </TabsContent>

      <TabsContent value="lighthouse">
        <LighthouseTab groupName={groupName} groupUrls={groupUrls} />
      </TabsContent>
    </Tabs>
  );
}
