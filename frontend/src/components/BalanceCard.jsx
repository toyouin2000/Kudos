function BalanceCard({
  title,
  value,
  subtitle,
  accent = false,
}) {
  return (
    <div
      className={`balance-card ${
        accent ? "balance-card-accent" : ""
      }`}
    >
      <div className="balance-card-title">
        {title}
      </div>

      <div className="balance-card-value">
        {value}
      </div>

      <div className="balance-card-subtitle">
        {subtitle}
      </div>
    </div>
  );
}

export default BalanceCard;