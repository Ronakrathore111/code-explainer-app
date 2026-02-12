require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const axios = require('axios');
const crypto = require('crypto'); 
const nodemailer = require('nodemailer');
const qs = require('qs');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch(err => console.error("❌ MongoDB Connection Error:", err));

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  resetPasswordToken: String,      
  resetPasswordExpires: Date,       
  history: [{
    code: String,
    explanation: String,
    timestamp: { type: Date, default: Date.now }
  }]
});

const User = mongoose.model('User', userSchema);

async function getIBMIAMToken(apiKey) {
  const response = await axios.post('https://iam.cloud.ibm.com/identity/token',
    qs.stringify({ grant_type: 'urn:ibm:params:oauth:grant-type:apikey', apikey: apiKey }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return response.data.access_token;
}

// Auth Routes
app.post('/signup', async (req, res) => {
  try {
    const { email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ email, password: hashedPassword });
    await newUser.save();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, message: "User already exists." });
  }
});

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (user && await bcrypt.compare(password, user.password)) {
      res.json({ success: true, email: user.email });
    } else {
      res.status(401).json({ success: false, message: "Invalid credentials." });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error." });
  }
});

// AI Logic
app.post('/explain', async (req, res) => {
  // Extract style from request body (sent by home.js)
  const { code, email, style } = req.body; 
  
  // 1. Prompt Engineering: Define instructions based on the selected style
  let instruction = "Explain this code logic step-by-step.";
  
  if (style === 'beginner') {
      instruction = "Explain this code like I am five years old. Use simple analogies and avoid technical jargon.";
  } else if (style === 'technical') {
      instruction = "Provide a deep technical analysis. Focus on logic flow, time complexity (Big O), and memory usage.";
  } else if (style === 'senior') {
      instruction = "Act as a Senior Developer. Review this code for best practices, suggest refactoring for clean code, and identify potential bugs.";
  }

  // 2. Format the prompt specifically for the Granite Instruct model
  const prompt = `[INST] <<SYS>>\n${instruction}\n<</SYS>>\nCode to explain:\n${code}\n\nExplanation: [/INST]`;

  try {
    const token = await getIBMIAMToken(process.env.IBM_API_KEY);
    const response = await axios.post(
      'https://us-south.ml.cloud.ibm.com/ml/v1/text/generation?version=2024-05-01',
      {
        model_id: "ibm/granite-8b-code-instruct", 
        input: prompt,
        parameters: { 
          decoding_method: "greedy", 
          max_new_tokens: 800,
          min_new_tokens: 20,
          repetition_penalty: 1.1
        },
        project_id: process.env.IBM_PROJECT_ID
      },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );

    const explanation = response.data.results?.[0]?.generated_text?.trim() || "AI returned empty.";
    

    if (email) {
      // The explanation saved to history will now match the selected style
      await User.findOneAndUpdate({ email }, { $push: { history: { code, explanation } } });
    }

    return res.json({ explanation }); 

  } catch (err) {
    console.error("❌ API ERROR:", err.response?.data || err.message);
    return res.status(500).json({ explanation: "Check Terminal for error details." });
  }
});

// History Routes (Ordered for No Conflicts)
app.get('/history', async (req, res) => {
  try {
    const { email } = req.query;
    const user = await User.findOne({ email });
    res.json({ history: user ? user.history : [] });
  } catch (err) {
    res.status(500).json({ message: "Server error fetching history." });
  }
});

app.delete('/history/all', async (req, res) => {
  try {
    const { email } = req.body;
    await User.findOneAndUpdate({ email }, { $set: { history: [] } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

app.delete('/history/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body;
    await User.findOneAndUpdate({ email }, { $pull: { history: { _id: id } } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});


app.post('/forgot-password', async (req, res) => {
    const { email } = req.body;

    try {
        // 1. Check if user exists in your MongoDB collection
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: "Email not found" });
        }

        // 2. Generate a secure random token
        const resetToken = crypto.randomBytes(32).toString('hex');
        
        // 3. Set token expiry (e.g., 1 hour)
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = Date.now() + 3600000; 
        await user.save();

        

// To this (passing the host dynamically):
const host = req.get('host');
const protocol = req.protocol; // http or https
await sendResetEmail(user.email, resetToken, host, protocol);

        res.status(200).json({ message: "Reset link sent successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

async function sendResetEmail(email, token, host, protocol) {
    const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false, // Must be false for port 587
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    const resetUrl = `${protocol}://${host}/reset-password/${token}`;

    const mailOptions = {
        from: `"Code Explainer AI" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Password Reset Request',
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                <h3 style="color: #3a7bd5;">Reset your password</h3>
                <p>You requested a password reset for your Code Explainer AI account.</p>
                <p>Click the button below to set a new password. This link is valid for 1 hour.</p>
                <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #00d2ff; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a>
                <p style="margin-top: 20px; font-size: 0.8rem; color: #777;">If the button doesn't work, copy and paste this link: <br> ${resetUrl}</p>
            </div>
        `
    };

    // Use a variable to capture the result for logging
    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent successfully: " + info.response); 
}
app.post('/reset-password/:token', async (req, res) => {
    const { token } = req.params;
    const { password } = req.body;

    try {
        // 1. Find user with valid token that has NOT expired
        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() } // $gt means "greater than"
        });

        if (!user) {
            return res.status(400).json({ message: "Password reset token is invalid or has expired." });
        }

        // 2. Hash the new password
        const hashedPassword = await bcrypt.hash(password, 10);
        user.password = hashedPassword;

        // 3. Clear the reset fields so the token cannot be used again
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;

        await user.save();
        res.json({ success: true, message: "Password has been updated!" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error during password reset." });
    }
});
// Serve the Reset Password HTML page
app.get('/reset-password/:token', (req, res) => {
    res.sendFile(__dirname + '/public/reset-password.html');
});
app.listen(port, () => console.log(`✅ Server running at http://localhost:${port}`));
