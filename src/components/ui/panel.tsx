import * as React from 'react';

type Props = React.HTMLAttributes<HTMLDivElement> & { as?: React.ElementType };

export default function Panel({ as: Tag = 'div', className = '', ...rest }: Props) {
  return <Tag className={`panel ${className}`} {...rest} />;
}
