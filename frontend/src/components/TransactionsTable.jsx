function TransactionsTable({
  transactions = [],
}) {
  return (
    <div className="table-container">

      <table className="transactions-table">

        <thead>

          <tr>
            <th>Date</th>
            <th>From</th>
            <th>To</th>
            <th>Points</th>
            <th>Message</th>
          </tr>

        </thead>

        <tbody>

          {transactions.length === 0 ? (

            <tr>

              <td
                colSpan="5"
                className="table-empty"
              >
                No transactions yet.
              </td>

            </tr>

          ) : (

            transactions.map(
              (transaction) => (

                <tr
                  key={transaction.id}
                >

                  <td>
                    {formatDate(
                      transaction.created_at
                    )}
                  </td>

                  <td>
                    {
                      transaction.sender
                        ?.name ||
                      "Unknown"
                    }
                  </td>

                  <td>
                    {
                      transaction.receiver
                        ?.name ||
                      "Unknown"
                    }
                  </td>

                  <td>

                    <span className="transaction-points">
                      {transaction.points}
                    </span>

                  </td>

                  <td>

                    <span className="transaction-message">
                      {transaction.message ||
                        "—"}
                    </span>

                  </td>

                </tr>

              )
            )

          )}

        </tbody>

      </table>

    </div>
  );
}


function formatDate(dateString) {

  if (!dateString) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(
    new Date(dateString)
  );
}


export default TransactionsTable;