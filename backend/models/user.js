const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { 
    type: String, 
    required: true, 
    trim: true 
  },
   company: { 
    type: String, 
    trim: true 
  },
  email: { 
    type: String, 
    required: true, 
    unique: true, 
    lowercase: true, 
    trim: true 
  },
  password: { 
    type: String, 
    required: true 
  },
  lastLogin: { 
    type: Date 
  }
}, { timestamps: true });

role: { 
  type: String, 
  enum: ['Requester', 'PreApprover', 'FinalApprover', 'Admin'], 
  default: 'Requester' 
}


module.exports = mongoose.model('User', userSchema);
