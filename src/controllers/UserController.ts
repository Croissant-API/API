import { Request, Response } from 'express';
import { inject } from 'inversify';
import { controller, httpDelete, httpGet, httpPost, httpPut } from "inversify-express-utils";
import { IUserService } from '../services/UserService';
import { createUserValidator, updateUserValidator, userIdParamValidator } from '../validators/UserValidator';

@controller("/api/users")
export class UserController {
    constructor(
        @inject("UserService") private userService: IUserService,
    ) {}

    @httpGet("/")
    public async getAllUsers(req: Request, res: Response) {
        const users = await this.userService.getAllUsers();
        // Filter and map users to only expose allowed fields
        const filteredUsers = users.map(user => ({
            userId: user.user_id,
            balance: user.balance,
            username: user.username,
        }));
        res.send(filteredUsers);
    }

    @httpGet("/:userId")
    public async getUser(req: Request, res: Response) {
        try {
            await userIdParamValidator.validate(req.params);
        } catch (err) {
            return res.status(400).send({ message: "Invalid userId", error: err });
        }
        const { userId } = req.params;
        const user = await this.userService.getUser(userId);
        if (!user) {
            return res.status(404).send({ message: "User not found" });
        }
        // Filter user to only expose allowed fields
        const filteredUser = {
            userId: user.user_id,
            balance: user.balance,
            username: user.username,
        };
        res.send(filteredUser);
    }

    @httpPost("/create")
    public async createUser(req: Request, res: Response) {
        try {
            await createUserValidator.validate(req.body);
        } catch (err) {
            return res.status(400).send({ message: "Invalid user data", error: err });
        }
        const { userId, username, balance } = req.body;
        try {
            await this.userService.createUser(userId, username, balance);
            res.status(201).send({ message: "User created" });
        } catch (error) {
            console.error("Error creating user", error);
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error creating user", error: message });
        }
    }

    @httpPut("/update/:userId")
    public async updateUser(req: Request, res: Response) {
        try {
            await userIdParamValidator.validate(req.params);
            await updateUserValidator.validate(req.body);
        } catch (err) {
            return res.status(400).send({ message: "Invalid data", error: err });
        }
        const { userId } = req.params;
        const { username, balance } = req.body;
        try {
            await this.userService.updateUser(userId, username, balance);
            res.status(200).send({ message: "User updated" });
        } catch (error) {
            console.error("Error updating user", error);
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error updating user", error: message });
        }
    }

    @httpDelete("/delete/:userId")
    public async deleteUser(req: Request, res: Response) {
        try {
            await userIdParamValidator.validate(req.params);
        } catch (err) {
            return res.status(400).send({ message: "Invalid userId", error: err });
        }
        const { userId } = req.params;
        try {
            await this.userService.deleteUser(userId);
            res.status(200).send({ message: "User deleted" });
        } catch (error) {
            console.error("Error deleting user", error);
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error deleting user", error: message });
        }
    }
}
