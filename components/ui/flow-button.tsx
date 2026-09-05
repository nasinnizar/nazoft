'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';

/** React adapter for the same branded styles used by the native CRM.
 * Import styles/flow-buttons.css and supply the CRM --blue/--red theme tokens.
 * This file is not bundled by the current vanilla-JavaScript application.
 */
export function FlowButton({ text = 'Continue', children, className = '', type = 'button', ...props }:
  ButtonHTMLAttributes<HTMLButtonElement> & { text?: string; children?: ReactNode }) {
  return <button {...props} type={type} className={`btn crm-flow-button ${className}`}>{children ?? text}</button>;
}
