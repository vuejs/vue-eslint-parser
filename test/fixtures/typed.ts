interface Data {
    greeting: string
}

export default {
    data(): Data {
        return {greeting: "Hello"}
    },
}
