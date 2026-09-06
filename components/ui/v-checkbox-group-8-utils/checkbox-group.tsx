"use client";

import * as React from "react";

type GroupState = {
  values: Set<string>;
  toggle: (value: string, checked: boolean) => void;
};

export const CheckboxGroupContext = React.createContext<GroupState | null>(null);

type CheckboxGroupProps = React.HTMLAttributes<HTMLDivElement> & {
  defaultValue?: string[];
};

export function CheckboxGroup({
  defaultValue = [],
  className = "",
  children,
  ...props
}: CheckboxGroupProps) {
  const [values, setValues] = React.useState(() => new Set(defaultValue));
  const toggle = React.useCallback((value: string, checked: boolean) => {
    setValues((current) => {
      const next = new Set(current);
      if (checked) next.add(value);
      else next.delete(value);
      return next;
    });
  }, []);

  return (
    <CheckboxGroupContext.Provider value={{ values, toggle }}>
      <div role="group" className={className} {...props}>
        {children}
      </div>
    </CheckboxGroupContext.Provider>
  );
}
