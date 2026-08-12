
const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const supabase = require("../db/supabase");

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is missing");
}


// =====================================================
// HELPERS
// =====================================================

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}


// =====================================================
// REGISTER
// =====================================================

router.post("/register", async (req, res) => {

  try {

    const {
      organizationName,
      name,
      email,
      password,
    } = req.body;


    // =================================================
    // VALIDATION
    // =================================================

    if (
      !organizationName ||
      !name ||
      !email ||
      !password
    ) {

      return res.status(400).json({
        error: "All fields are required",
      });

    }


    if (password.length < 6) {

      return res.status(400).json({
        error:
          "Password must be at least 6 characters",
      });

    }


    const normalizedEmail =
      normalizeEmail(email);


    if (!normalizedEmail) {

      return res.status(400).json({
        error: "Invalid email",
      });

    }


    // =================================================
    // CHECK EXISTING USER
    // =================================================

    const {
      data: existingUsers,
      error: userCheckError,
    } = await supabase

      .from("users")

      .select("id")

      .ilike(
        "email",
        normalizedEmail
      )

      .limit(1);


    if (userCheckError) {

      console.error(
        "User existence check error:",
        userCheckError
      );

      return res.status(500).json({
        error: "Database error",
      });

    }


    if (
      existingUsers &&
      existingUsers.length > 0
    ) {

      return res.status(409).json({
        error:
          "An account with this email already exists",
      });

    }


    // =================================================
    // CHECK EXISTING ORGANIZATION
    // =================================================

    const {
      data: existingOrganizations,
      error: organizationCheckError,
    } = await supabase

      .from("organizations")

      .select("id")

      .ilike(
        "email",
        normalizedEmail
      )

      .limit(1);


    if (organizationCheckError) {

      console.error(
        "Organization existence check error:",
        organizationCheckError
      );

      return res.status(500).json({
        error: "Database error",
      });

    }


    if (
      existingOrganizations &&
      existingOrganizations.length > 0
    ) {

      return res.status(409).json({
        error:
          "An organization with this email already exists",
      });

    }


    // =================================================
    // HASH PASSWORD
    // =================================================

    const passwordHash =
      await bcrypt.hash(
        password,
        10
      );


    // =================================================
    // CREATE ORGANIZATION
    // =================================================

    const {
      data: organization,
      error: organizationError,
    } = await supabase

      .from("organizations")

      .insert({

        name:
          organizationName.trim(),

        email:
          normalizedEmail,

        monthly_points:
          100,

      })

      .select(`
        id,
        name,
        email,
        monthly_points
      `)

      .single();


    if (organizationError) {

      console.error(
        "Organization creation error:",
        organizationError
      );


      if (
        organizationError.code ===
        "23505"
      ) {

        return res.status(409).json({
          error:
            "An organization with this email already exists",
        });

      }


      return res.status(500).json({
        error:
          "Failed to create organization",
      });

    }


    // =================================================
    // CREATE ADMIN
    // =================================================

    const {
      data: user,
      error: userError,
    } = await supabase

      .from("users")

      .insert({

        organization_id:
          organization.id,

        slack_user_id:
          null,

        slack_username:
          null,

        name:
          name.trim(),

        email:
          normalizedEmail,

        password_hash:
          passwordHash,

        role:
          "admin",

        reward_balance:
          organization.monthly_points,

        received_balance:
          0,

        is_active:
          true,

      })

      .select(`
        id,
        organization_id,
        name,
        email,
        role,
        reward_balance,
        received_balance,
        slack_user_id,
        slack_username,
        is_active
      `)

      .single();


    if (userError) {

      console.error(
        "Admin creation error:",
        userError
      );


      // Roll back organization
      await supabase

        .from("organizations")

        .delete()

        .eq(
          "id",
          organization.id
        );


      if (
        userError.code ===
        "23505"
      ) {

        return res.status(409).json({
          error:
            "An account with this email already exists",
        });

      }


      return res.status(500).json({
        error:
          "Failed to create admin user",
      });

    }


    // =================================================
    // JWT
    // =================================================

    const token =
      jwt.sign(

        {
          userId:
            user.id,

          organizationId:
            organization.id,

          role:
            user.role,
        },

        JWT_SECRET,

        {
          expiresIn:
            "7d",
        }

      );


    // =================================================
    // RESPONSE
    // =================================================

    return res.status(201).json({

      message:
        "Organization created successfully",

      token,

      user: {

        id:
          user.id,

        name:
          user.name,

        email:
          user.email,

        role:
          user.role,

      },

      organization: {

        id:
          organization.id,

        name:
          organization.name,

      },

    });


  } catch (error) {

    console.error(
      "Registration error:",
      error
    );


    return res.status(500).json({
      error:
        "Internal server error",
    });

  }

});


// =====================================================
// LOGIN
// =====================================================

router.post("/login", async (req, res) => {

  try {

    const {
      email,
      password,
    } = req.body;


    // =================================================
    // VALIDATION
    // =================================================

    if (
      !email ||
      !password
    ) {

      return res.status(400).json({
        error:
          "Email and password are required",
      });

    }


    const normalizedEmail =
      normalizeEmail(email);


    // =================================================
    // FIND USER
    //
    // We intentionally DON'T use .single()
    // because existing data may contain duplicates.
    // =================================================

    const {
      data: users,
      error: userLookupError,
    } = await supabase

      .from("users")

      .select(`
        id,
        organization_id,
        name,
        email,
        password_hash,
        role,
        reward_balance,
        received_balance,
        slack_user_id,
        slack_username,
        is_active
      `)

      .ilike(
        "email",
        normalizedEmail
      )

      .eq(
        "is_active",
        true
      );


    // =================================================
    // DATABASE ERROR
    // =================================================

    if (userLookupError) {

      console.error(
        "Login user lookup error:",
        userLookupError
      );

      return res.status(500).json({
        error:
          "Database error",
      });

    }


    // =================================================
    // NO USER
    // =================================================

    if (
      !users ||
      users.length === 0
    ) {

      return res.status(401).json({
        error:
          "Invalid email or password",
      });

    }


    // =================================================
    // DUPLICATE EMAIL
    // =================================================

    if (
      users.length > 1
    ) {

      console.error(
        "DUPLICATE_LOGIN_EMAIL:",
        {
          email:
            normalizedEmail,

          userIds:
            users.map(
              (user) =>
                user.id
            ),

        }
      );


      return res.status(409).json({

        error:
          "Multiple accounts exist with this email. Please contact support.",

      });

    }


    const user =
      users[0];


    // =================================================
    // PASSWORD HASH CHECK
    // =================================================

    if (
      !user.password_hash
    ) {

      console.error(
        "PASSWORD_HASH_MISSING:",
        {
          userId:
            user.id,

          email:
            normalizedEmail,
        }
      );


      return res.status(500).json({

        error:
          "This account does not have a valid password configured.",

      });

    }


    // =================================================
    // VERIFY PASSWORD
    // =================================================

    let passwordValid =
      false;


    try {

      passwordValid =
        await bcrypt.compare(
          password,
          user.password_hash
        );

    } catch (bcryptError) {

      console.error(
        "Password verification error:",
        bcryptError
      );


      return res.status(500).json({

        error:
          "Unable to verify password",

      });

    }


    if (
      !passwordValid
    ) {

      return res.status(401).json({
        error:
          "Invalid email or password",
      });

    }


    // =================================================
    // JWT
    // =================================================

    const token =
      jwt.sign(

        {
          userId:
            user.id,

          organizationId:
            user.organization_id,

          role:
            user.role,
        },

        JWT_SECRET,

        {
          expiresIn:
            "7d",
        }

      );


    // =================================================
    // RESPONSE
    // =================================================

    return res.json({

      message:
        "Login successful",

      token,

      user: {

        id:
          user.id,

        name:
          user.name,

        email:
          user.email,

        role:
          user.role,

      },

      organizationId:
        user.organization_id,

    });


  } catch (error) {

    console.error(
      "Login error:",
      error
    );


    return res.status(500).json({
      error:
        "Internal server error",
    });

  }

});


// =====================================================
// EXPORT
// =====================================================

module.exports =
  router;