const authService = require('../services/auth.service');

const register = async (req, res) => {
  try {
    console.log("Mencoba Register:", req.body.email);
    const user = await authService.registerUser({
      ...req.body,
      medicalLicense: req.file ? `/uploads/licenses/${req.file.filename}` : req.body.medicalLicense,
    });
    res.status(201).json({ message: "Register Berhasil", data: user });
  } catch (err) {
    console.error("Gagal Register:", err.message);
    res.status(400).json({ error: err.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await authService.loginUser(email, password);
    res.status(200).json({ message: "Login Berhasil", ...result });
  } catch (err) {
    console.error("Gagal Login:", err.message);
    const statusCode = err.status || 401;
    res.status(statusCode).json({
      status: "error",
      message: err.message,
      error: err.message,
    });
  }
};

const redirectToGoogle = (req, res) => {
  try {
    res.redirect(authService.getGoogleAuthorizationUrl());
  } catch (err) {
    console.error("Gagal memulai Google OAuth:", err.message);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const callbackUrl = new URL('/auth/google/callback', frontendUrl);
    callbackUrl.searchParams.set('error', err.message);
    res.redirect(callbackUrl.toString());
  }
};

const googleCallback = async (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const callbackUrl = new URL('/auth/google/callback', frontendUrl);

  try {
    if (req.query.error) {
      throw new Error(req.query.error);
    }

    const profile = await authService.getGoogleProfileFromCode(req.query.code, req.query.state);
    const result = await authService.loginWithGoogleProfile(profile);

    callbackUrl.searchParams.set('token', result.token);
    callbackUrl.searchParams.set('role', result.role);
    if (result.verificationStatus) {
      callbackUrl.searchParams.set('verificationStatus', result.verificationStatus);
    }
  } catch (err) {
    console.error("Gagal Google Login:", err.message);
    callbackUrl.searchParams.set('error', err.message);
  }

  res.redirect(callbackUrl.toString());
};

// const getUsers = async (req, res) => {
//   try {
//     const users = await authService.getAllUsers();
//     res.status(200).json(users);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// };

// const getUserById = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const user = await authService.getUserById(id);
    
//     res.status(200).json({
//       status: "success",
//       data: user
//     });
//   } catch (err) {
//     res.status(404).json({ 
//       status: "error", 
//       message: err.message 
//     });
//   }
// };

module.exports = { register, login, redirectToGoogle, googleCallback };
