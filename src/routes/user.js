import express from "express"

const userRouter = express.Router()

userRouter.get("/", (req, res) => {
    res.send("User get method")
})

userRouter.post("/", (req, res) => {
    res.send("User post method")
})

userRouter.put("/", (req, res) => {
    res.send("User put method")
})

userRouter.delete("/", (req, res) => {
    res.send("User delete method")
})

export {userRouter}