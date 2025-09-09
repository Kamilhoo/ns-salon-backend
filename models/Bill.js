const mongoose = require('mongoose');

const billSchema = new mongoose.Schema({
  // Client Information
  clientId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Client', 
    required: true 
  },
  clientName: { 
    type: String, 
    required: true 
  },
  clientPhone: { 
    type: String 
  },
  
  // Service Details
  services: [{
    name: { 
      type: String, 
      required: true 
    },
    price: { 
      type: Number, 
      required: true 
    },
    duration: { 
      type: String 
    },
    description: { 
      type: String 
    }
  }],
  
  // Appointment Details
  appointmentDate: { 
    type: Date, 
    default: Date.now 
  },
  startTime: { 
    type: String 
  },
  specialist: { 
    type: String 
  },
  totalDuration: { 
    type: String 
  },
  
  // Billing Information
  subtotal: { 
    type: Number, 
    required: true 
  },
  discount: { 
    type: Number, 
    default: 0 
  },
  amountBeforeGST: { 
    type: Number, 
    required: true 
  },
  gstPercentage: { 
    type: Number, 
    default: 0 
  },
  gstAmount: { 
    type: Number, 
    default: 0 
  },
  totalAmount: { 
    type: Number, 
    required: true 
  },
  finalAmount: { 
    type: Number, 
    required: true 
  },
  
  // Payment Information
  paymentMethod: { 
    type: String, 
    enum: ['cash', 'card', 'online', 'other'], 
    default: 'cash' 
  },
  paymentStatus: { 
    type: String, 
    enum: ['pending', 'paid', 'partially_paid', 'cancelled'], 
    default: 'pending' 
  },
  paidAt: { 
    type: Date 
  },
  
  // Additional Information
  notes: { 
    type: String 
  },
  
  // Bill Generation
  billNumber: { 
    type: String, 
    unique: true 
  },
  
  // Timestamps
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Generate bill number before saving
billSchema.pre('save', function(next) {
  if (!this.billNumber) {
    const timestamp = Date.now();
    this.billNumber = `BILL${timestamp}`;
  }
  this.updatedAt = new Date();
  next();
});

// Indexes for better performance
billSchema.index({ clientId: 1 });
billSchema.index({ billNumber: 1 });
billSchema.index({ appointmentDate: 1 });
billSchema.index({ paymentStatus: 1 });
billSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Bill', billSchema);
