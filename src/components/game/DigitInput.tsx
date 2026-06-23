import React, { useRef, useEffect } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { useDigitMarks, markInputStyles } from '@/contexts/DigitMarksContext';
import { sfx } from '@/lib/sfx';

interface DigitInputProps {
  codeLength: number;
  allowDuplicates: boolean;
  onSubmit: (digits: number[]) => void;
  disabled?: boolean;
  submitLabel?: string;
}

const DigitInput: React.FC<DigitInputProps> = ({
  codeLength,
  allowDuplicates,
  onSubmit,
  disabled = false,
  submitLabel,
}) => {
  const { t } = useLanguage();
  const marksCtx = useDigitMarks();
  const [digits, setDigits] = React.useState<string[]>(Array(codeLength).fill(''));
  const [errors, setErrors] = React.useState<boolean[]>(Array(codeLength).fill(false));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    setDigits(Array(codeLength).fill(''));
    setErrors(Array(codeLength).fill(false));
  }, [codeLength]);

  const flashError = (index: number) => {
    sfx.error();
    const newErrors = [...errors];
    newErrors[index] = true;
    setErrors(newErrors);
    setTimeout(() => {
      const cleared = [...newErrors];
      cleared[index] = false;
      setErrors(cleared);
    }, 500);
  };

  const handleChange = (index: number, value: string) => {
    const char = value.slice(-1);
    if (char && !/^[0-9]$/.test(char)) {
      flashError(index);
      return;
    }

    const newDigits = [...digits];
    newDigits[index] = char;

    if (!allowDuplicates && char) {
      const isDuplicate = newDigits.some((d, i) => i !== index && d === char);
      if (isDuplicate) {
        flashError(index);
        return;
      }
    }

    setDigits(newDigits);
    setErrors(Array(codeLength).fill(false));
    if (char) sfx.type();

    if (char && index < codeLength - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    if (digits.every((d) => d !== '')) {
      sfx.submit();
      onSubmit(digits.map(Number));
      setDigits(Array(codeLength).fill(''));
      inputRefs.current[0]?.focus();
    }
  };

  const allFilled = digits.every((d) => d !== '');

  return (
    <div className="space-y-4" dir="ltr">
      <div className="flex gap-2 justify-center">
        {digits.map((digit, i) => {
          const mark = digit && marksCtx ? marksCtx.getMark(Number(digit)) : 'neutral';
          const markCls = digit ? markInputStyles[mark] : '';
          const baseFilled = mark === 'neutral' ? 'border-primary text-primary glow-primary' : markCls;
          return (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              disabled={disabled}
              className={`w-12 h-14 text-center font-mono text-xl rounded-lg bg-card cyber-border outline-none transition-all duration-200 ${
                errors[i]
                  ? 'border-destructive text-destructive animate-shake'
                  : digit
                  ? baseFilled
                  : 'text-foreground focus:border-primary focus:glow-primary'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
          );
        })}
      </div>
      <button
        onClick={handleSubmit}
        disabled={disabled || !allFilled}
        className={`w-full py-3 rounded-lg font-mono font-bold transition-all ${
          allFilled && !disabled
            ? 'bg-primary text-primary-foreground glow-primary hover:opacity-90'
            : 'bg-muted text-muted-foreground cursor-not-allowed'
        }`}
      >
        {submitLabel || t('guess')}
      </button>
    </div>
  );
};

export default DigitInput;
