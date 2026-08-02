export default function FieldError({ message, className = '' }) {
  if (!message) return null

  return <p className={`bc-field-error ${className}`.trim()} role="alert">{message}</p>
}
