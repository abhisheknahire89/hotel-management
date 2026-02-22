import mongoose from 'mongoose';

const stateSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  {
    timestamps: true,
  },
);

export const StateModel = mongoose.models.State || mongoose.model('State', stateSchema);
