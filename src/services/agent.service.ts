import bcrypt from 'bcrypt';
import { IAgent } from "../interfaces/agent.interface"
import agentModel from "../models/agent.model"
import jwt from 'jsonwebtoken';
import { sendEmail } from '../utils/user.util';

class AgentService{

    public signup = async (body: IAgent): Promise<any> => {
        try{
            const res = await agentModel.findOne({email: body.email});
            if(!res){
                try{
                    body.password = await bcrypt.hash(body.password, 10);
                  }catch(err){
                    throw new Error("Error occured in hash: "+err);
                  }
                await agentModel.create(body)
                return "Agent created successfully"
            }
            else
                throw new Error("User already exist")
        } catch(error){
            throw new Error(error.message)
        }
        
    } 

    public signin = async (body): Promise<any> => {
        const res = await agentModel.findOne({email: body.email});
    if (!res) {
      throw new Error("Invalid email"); // User not found
    }
    const match = await bcrypt.compare(body.password, res.password);
    if(match){
      const payload = { userId: res._id, email: res.email };
      const token = jwt.sign({ userId: res._id, email: res.email }, process.env.AGENT_SECRET);
      const refreshToken = jwt.sign(payload, process.env.AGENT_SECRET, { expiresIn: '7d' });
      await agentModel.findByIdAndUpdate(res._id, { refreshToken });

      return {
        message: "Login Successful",
        name: res.name,
        token: token,
      }   
    }
    else{
      throw new Error("Incorrect password");
    }
    }

    // Get all agents
    public getAllAgents = async (): Promise<IAgent[]> => {
        try {
            const res = await agentModel.find().select('-password');
            if(!res || res.length === 0) {
                throw new Error('No plans found');
            }
            return res;
        } catch (error) {
            throw error;
        }
    };
    public refreshToken = async (agentId: string): Promise<any> => {
      try {
        const agentRecord=await agentModel.findById(agentId);
        const refreshToken=agentRecord.refreshToken;
        if (!refreshToken) {
          throw new Error('Refresh token is missing');
        }
        const payload : any= jwt.verify(refreshToken, process.env.AGENT_SECRET );
        const { userId, email } = payload;
        const newAccessToken = jwt.sign({ userId, email }, process.env.CUSTOMER_SECRET, { expiresIn: '1h' });
        return newAccessToken;
      } catch (error) {
        throw new Error(`Error: ${error.message}`);  
      } 
    };

    // forget password
    public forgotPassword = async (email: string): Promise<void> => {
      try{
        const agentData = await agentModel.findOne({ email });
        if (!agentData) {
          throw new Error('Email not found');
        }
        const token = jwt.sign({ id: agentData._id }, process.env.AGENT_RESET_SECRET, { expiresIn: '1h' });
        await sendEmail(email, token);
      } catch(error){
        throw new Error("Error occured cannot send email: "+error)
      }
    };
  
    //reset password
    public resetPassword = async (body: any, userId): Promise<void> => {
      const agentData = await agentModel.findById(userId);
      if (!agentData) {
        throw new Error('Email not found');
      }
      const hashedPassword = await bcrypt.hash(body.newPassword, 10);
      agentData.password = hashedPassword;
      await agentData.save();
    };
    

}

export default AgentService