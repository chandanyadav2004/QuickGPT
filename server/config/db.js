import mongoose from "mongoose";

const connectDB = async () => {
    try {
        mongoose.connection.on('connected', () => console.log("Database connected"))
        await mongoose.connect(`${process.env.MONGOBD_URI}/quickgpt`)
    } catch (error) {
        console.log(error.message)
    }
}

export default connectDB;