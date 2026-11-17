"use client";

import type { SelectHTMLAttributes } from "react";

/** A plain <select> that submits its enclosing GET form on change. Works without JS as a normal select + Search button. */
export function AutoSubmitSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`select ${props.className ?? ""}`}
      onChange={(e) => {
        props.onChange?.(e);
        e.currentTarget.form?.requestSubmit();
      }}
    />
  );
}
