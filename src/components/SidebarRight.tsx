'use client';
import * as React from 'react';

import DiscoverSpacesCard from '@/components/discover/DiscoverSpacesCard';

export default function SidebarRight(): React.ReactElement {
  return (
    <div className="space-y-4">
      <DiscoverSpacesCard />
    </div>
  );
}
