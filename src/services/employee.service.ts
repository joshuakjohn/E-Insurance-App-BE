import { IEmployee } from "../interfaces/employee.interface";
import employeeModel from "../models/employee.model";
import bcrypt from "bcrypt";
import jwt from 'jsonwebtoken';
import { sendEmail } from "../utils/user.util";
import redisClient from "../config/redis";


class EmployeeService{

    // Register a new Employee
    public createEmployee = async (body: IEmployee): Promise<any> => {
        try {
            const existingEmployee = await employeeModel.findOne({ email: body.email });
            if (existingEmployee) {
                throw new Error('Employee already exists');
            }

            const hashedPassword = await bcrypt.hash(body.password, 10);
            body.password = hashedPassword;
            await employeeModel.create(body);

            // Invalidate cache for all agents
            await redisClient.del('employees:all');

            return 'Employee registerd successfully';
        } catch (error) {
            throw new Error(error.message);
        }
    };

    // Employee login
    public loginEmployee = async (body: IEmployee): Promise<any> => {
        try {
            const employeeData = await employeeModel.findOne({ email: body.email });
            if (!employeeData) {
                throw new Error('Employee not found');
            }

            const isMatch = await bcrypt.compare(body.password, employeeData.password);
            if (!isMatch) {
                throw new Error('Invalid password');
            }

            const payload = { userId: employeeData._id, email: employeeData.email };
            const token = jwt.sign(payload, process.env.EMPLOYEE_SECRET);
            const refreshToken = jwt.sign(payload, process.env.EMPLOYEE_SECRET, { expiresIn: '7d' });
            await employeeModel.findByIdAndUpdate(employeeData._id, { refreshToken });
            return {token, username: employeeData.username, email: employeeData.email};
        } catch (error) {
            throw new Error(error.message);
        }
    };

    // Get all employee
    public getAllEmployee = async (): Promise<{data: IEmployee[], source: string}> => {
        try {    
            // Check if the data is cached in Redis
            const cachedData = await redisClient.get('employees:all');
            if (cachedData) {
                return {
                    data: JSON.parse(cachedData),
                    source: 'Redis Cache',
                };
            }
    
            // Fetch employee data from the database
            const employees = await employeeModel.find().select('-password -refreshToken');
            if (!employees || employees.length === 0) {
                throw new Error('No employees found.');
            }
    
            // Cache the employee data for 60 seconds
            await redisClient.setEx('employees:all', 60, JSON.stringify(employees));
    
            return {
                data: employees,
                source: 'Database',
            };
        } catch (error) {
            throw new Error(`Error retrieving employees: ${error.message}`);
        }
    };

    public refreshToken = async (employeeId: string): Promise<any> => {
        try {
            const employeeData = await employeeModel.findById(employeeId);
            const refreshToken = employeeData.refreshToken
            if (!refreshToken) {
                throw new Error('Refresh token is missing');
            }
            const payload : any= jwt.verify(refreshToken, process.env.EMPLOYEE_SECRET);
            const { userId, email } = payload;
            const newAccessToken = jwt.sign({ userId, email }, process.env.EMPLOYEE_SECRET, { expiresIn: '1h' });
            return newAccessToken;
        } catch (error) {
            throw new Error(`Error: ${error.message}`);
        }
    };

    // forget password
    public forgotPassword = async (email: string): Promise<void> => {
        try{
        const employeeData = await employeeModel.findOne({ email });
        if (!employeeData) {
            throw new Error('Email not found');
        }
        const token = jwt.sign({ userId: employeeData._id }, process.env.EMPLOYEE_RESET_SECRET, { expiresIn: '1h' });
        await sendEmail(email, token);
        } catch(error){
        throw new Error("Error occured cannot send email: "+error)
        }
    };

    //reset password
    public resetPassword = async (body: any, userId): Promise<void> => {
        const employeeData = await employeeModel.findById(userId);
        if (!employeeData) {
            throw new Error('User not found');
        }
        const hashedPassword = await bcrypt.hash(body.newPassword, 10);
        employeeData.password = hashedPassword;
        await employeeData.save();
    };

}

export default EmployeeService;