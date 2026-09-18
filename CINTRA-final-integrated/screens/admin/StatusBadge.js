import React from 'react';
import Badge from '../../components/Badge';

export default function StatusBadge({ status, customLabel }) {
  return (
    <Badge
      label={customLabel || status}
      type={status}
    />
  );
}
