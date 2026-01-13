import { Textarea } from '@/components/ui/textarea';

interface JsonEditorTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}

export function JsonEditorTextarea({
  value,
  onChange,
  placeholder,
  rows = 6,
}: JsonEditorTextareaProps) {
  return (
    <Textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="font-mono text-xs"
    />
  );
}
