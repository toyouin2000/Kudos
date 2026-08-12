
import { useState } from "react";


function MembersTable({
  users = [],
  isAdmin,
  onGiftCard,
}) {

  // =====================================================
  // LOADING STATE
  // =====================================================

  const [
    loadingUserId,
    setLoadingUserId,
  ] = useState(null);


  // =====================================================
  // OPEN GIFT CARD FLOW
  // =====================================================
  //
  // IMPORTANT:
  //
  // MembersTable does NOT create the payout.
  //
  // It only selects the employee.
  //
  // Dashboard -> GiftCardModal -> API
  //
  // =====================================================

  const handleSendGiftCard =
    async (user) => {

      try {

        setLoadingUserId(
          user.id
        );


        // Open the Gift Card modal.
        //
        // Dashboard owns the actual
        // payout/redemption process.

        onGiftCard(user);


      } finally {

        // Modal is responsible for the
        // actual payout operation.
        //
        // We can immediately release
        // the table button loading state.

        setLoadingUserId(
          null
        );

      }

    };


  // =====================================================
  // RENDER
  // =====================================================

  return (

    <div className="table-container">

      <table className="members-table">

        <thead>

          <tr>

            <th>
              Employee
            </th>

            <th>
              Role
            </th>

            <th>
              Reward Balance
            </th>

            <th>
              Received Balance
            </th>

            {isAdmin && (

              <th>
                Gift Card
              </th>

            )}

          </tr>

        </thead>


        <tbody>

          {users.length === 0 ? (

            <tr>

              <td
                colSpan={
                  isAdmin
                    ? 5
                    : 4
                }

                className="table-empty"
              >

                No employees found.

              </td>

            </tr>

          ) : (

            users.map(
              (user) => (

                <tr
                  key={
                    user.id
                  }
                >

                  {/* =====================================
                      EMPLOYEE
                  ====================================== */}

                  <td>

                    <div className="employee-cell">

                      <div className="employee-avatar">

                        {getInitials(
                          user.name
                        )}

                      </div>


                      <div>

                        <div className="employee-name">

                          {user.name}

                        </div>


                        <div className="employee-email">

                          {user.email ||
                            "No email"}

                        </div>

                      </div>

                    </div>

                  </td>


                  {/* =====================================
                      ROLE
                  ====================================== */}

                  <td>

                    <span
                      className={`role-badge ${
                        user.role ===
                        "admin"
                          ? "role-admin"
                          : ""
                      }`}
                    >

                      {user.role}

                    </span>

                  </td>


                  {/* =====================================
                      REWARD BALANCE
                  ====================================== */}

                  <td>

                    <span className="reward-points">

                      {user.reward_balance}

                    </span>

                  </td>


                  {/* =====================================
                      RECEIVED BALANCE
                  ====================================== */}

                  <td>

                    <span className="received-points">

                      {user.received_balance}

                    </span>

                  </td>


                  {/* =====================================
                      GIFT CARD
                  ====================================== */}

                  {isAdmin && (

                    <td>

                      <button

                        className="member-gift-button"

                        disabled={

                          user.received_balance <=
                          0 ||

                          loadingUserId ===
                          user.id

                        }

                        onClick={() =>
                          handleSendGiftCard(
                            user
                          )
                        }

                      >

                        {loadingUserId ===
                        user.id

                          ? "Opening..."

                          : "🎁 Send Gift Card"}

                      </button>

                    </td>

                  )}

                </tr>

              )

            )

          )}

        </tbody>

      </table>

    </div>

  );

}


// =====================================================
// GET INITIALS
// =====================================================

function getInitials(
  name = ""
) {

  const parts =
    name
      .trim()
      .split(/\s+/);


  if (
    parts.length ===
    0
  ) {

    return "?";

  }


  if (
    parts.length ===
    1
  ) {

    return parts[0]
      .slice(0, 2)
      .toUpperCase();

  }


  return (

    parts[0][0] +

    parts[
      parts.length - 1
    ][0]

  ).toUpperCase();

}


export default MembersTable;
