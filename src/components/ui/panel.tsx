import * as React from 'react';

type Props = React.HTMLAttributes<HTMLDivElement> & { as?: keyof JSX.IntrinsicElements };

export default function Panel({ as:Tag='div', className='', ...rest }: Props){
  return <Tag className={`panel ${className}`} {...rest} />;
}
