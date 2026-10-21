import { useState, useEffect, memo } from 'react';

const CellInput = memo(({ value, onChange, placeholder, ariaLabel, className, title, readOnly }) => {
  const [localValue, setLocalValue] = useState(value || '');

  // Sync local state if the prop changes externally
  useEffect(() => {
    setLocalValue(value || '');
  }, [value]);

  const handleBlur = () => {
    if (localValue !== (value || '')) {
      onChange(localValue);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.target.blur();
    }
  };

  return (
    <input
      className={className}
      type="text"
      value={localValue}
      title={title || localValue}
      placeholder={placeholder}
      aria-label={ariaLabel}
      readOnly={readOnly}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
  );
});

export default CellInput;
