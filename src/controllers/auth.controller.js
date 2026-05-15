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
    // Jika error "Invalid email or password", kirim status 401
    res.status(401).json({
      status: "error",
      message: err.message,
      error: err.message,
    });
  }
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

module.exports = { register, login };
