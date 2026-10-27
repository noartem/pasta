import { test } from "node:test";
import assert from "node:assert/strict";

import { detectCsvDelimiter, detectLanguage } from "./detect-language.js";

const samples = {
    plaintext: [
        "",
        "Buy milk",
        "Hello, world!\nSee you tomorrow.",
        "Meeting notes\n\nWe agreed to ship on Friday, if the tests pass. Then we deploy, and celebrate.\nAsk Bob about the budget.",
        "Note: call the plumber\nhttps://example.com/some/page",
        "Dear team,\nThanks for the update, looks good.",
        "Hi John, how are you?\nCall me tomorrow, please.",
        "Milk, eggs\nBread, butter\nApples, pears",
        "Привет, как дела?\nЗавтра в 10, не опаздывай.",
        "Moscow 55.75, 37.61\nParis 48.85, 2.35",
        "Name: John\nPhone: +1 555 0100\nEmail: john@example.com",
        "Alice: hi, how are you?\nBob: fine, thanks",
        "I use this every day.\nWe use it at work too.",
        "Ok, sounds good.\nNone of them came -> reschedule",
        "We use the public beta, it costs $20.\nThe class starts at 9, use the side door.",
        "Pricing: $5 per month\nWe use it for every class",
    ],
    markdown: [
        "# Title\n\nSome **bold** text and a [link](https://example.com).\n\n- one\n- two",
        "Install it:\n\n```bash\nnpm install\nnpm run build\n```\n\nThen run it.",
        "| a | b |\n|---|---|\n| 1 | 2 |",
    ],
    csv: [
        "name,age,city\nAlice,30,Paris\nBob,25,Berlin",
        "id;name;price\n1;Apple;1,20\n2;Pear;0,90\n3;Plum;2,00",
        "id\tname\tprice\n1\tApple\t1.20\n2\tPear\t0.90",
        'id,comment\n1,"Hello, world"\n2,"Multi\nline"\n3,plain',
        "id,name,active\n1,foo,null\n2,bar,null",
        "user_id,deleted_at\n1,null\n2,null\n3,2024-01-01",
        "id,parent\n1,None\n2,None\n3,1",
        'item,size\nTV,55" screen\nMonitor,27" screen',
        "repo,visibility\npasta,public\nsecret,private\nsite,public",
    ],
    json: ['{"a": 1, "b": [true, null]}', "[1, 2, 3]"],
    yaml: [
        "name: pasta\nversion: 1.0\ndependencies:\n  - axum\n  - sqlx\n",
        "services:\n  app:\n    image: ghcr.io/noartem/pasta\n    ports:\n      - \"8000:8000\"\n",
    ],
    html: ["<!doctype html>\n<html>\n<body>\n<div>Hello</div>\n</body>\n</html>"],
    css: ["body {\n    margin: 0;\n    color: #333;\n}\n\n.btn {\n    padding: 4px 8px;\n}"],
    javascript: [
        "if (user) {\n    showProfile(user);\n} else {\n    const login = await askLogin();\n    redirect(login);\n}",
        'const a = 1;\nfunction foo(x) {\n    return x === null ? undefined : x;\n}\ndocument.addEventListener("click", () => console.log(a));',
    ],
    typescript: [
        "export class User {\n  name: string;\n  age: number;\n\n  constructor(name: string) {\n    this.name = name;\n  }\n}",
        "interface User {\n    name: string;\n    age: number;\n}\n\nconst greet = (user: User): string => `Hi ${user.name}`;\nexport type Id = string;",
    ],
    python: [
        "#!/usr/bin/env python3\nprint('hi')",
        "import os\n\ndef main():\n    for name in os.listdir('.'):\n        if name.endswith('.py'):\n            print(name)\n\nif __name__ == '__main__':\n    main()",
    ],
    php: ["<?php\n\nnamespace App;\n\nclass Foo extends Bar\n{\n    public function run() { echo $this->name; }\n}"],
    rust: [
        "use std::collections::HashMap;\n\nfn main() {\n    let mut map = HashMap::new();\n    map.insert(1, \"a\");\n    println!(\"{:?}\", map);\n}",
    ],
    go: [
        "func add(a int, b int) int {\n\tsum := a + b\n\treturn sum\n}",
        'package main\n\nimport (\n\t"fmt"\n)\n\nfunc main() {\n\tx := 1\n\tif err != nil {\n\t\treturn\n\t}\n\tfmt.Println(x)\n}',
    ],
    java: [
        "public static int sum(int[] a) {\n    int total = 0;\n    int i = 0;\n    for (int x : a) {\n        total += x;\n    }\n    return total;\n}",
        "public int add(int a, int b) {\n    return a + b;\n}",
        "public class Point {\n    private int x;\n\n    public Point(int x) {\n        this.x = x;\n    }\n\n    public int getX() {\n        return x;\n    }\n}",
        "@Service\npublic class UserService {\n    private final UserRepository repository;\n\n    public UserService(UserRepository repository) {\n        this.repository = repository;\n    }\n\n    public User find(long id) {\n        return repository.findById(id).orElseThrow();\n    }\n}",
        'package com.example;\n\nimport java.util.List;\n\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Hi");\n    }\n}',
    ],
    cpp: [
        "int add(int a, int b) {\n    int sum = a + b;\n    return sum;\n}\n\nvoid reset(char *buf) {\n    buf[0] = 0;\n}",
        "#include <iostream>\n\nint main() {\n    std::cout << \"Hi\" << std::endl;\n    return 0;\n}",
        '#include <stdio.h>\n\nint main(void) {\n    printf("hi\\n");\n    return 0;\n}',
    ],
    shell: [
        "#!/bin/bash\nset -e\necho hi",
        "sudo apt-get update\nsudo apt-get install -y nginx\nsystemctl restart nginx",
        "$ git clone https://github.com/noartem/pasta\n$ cd pasta && npm ci",
        'echo "Deploying to $HOST"\nexport PATH=$HOME/bin:$PATH\necho done',
    ],
    sql: [
        "SELECT id, name FROM users WHERE age > 18 ORDER BY name;",
        "CREATE TABLE posts (id INTEGER PRIMARY KEY);\nINSERT INTO posts VALUES (1);\nDELETE FROM posts WHERE id = 1;",
    ],
};

for (const [language, texts] of Object.entries(samples)) {
    test(`detects ${language}`, () => {
        for (const text of texts) {
            assert.equal(detectLanguage(text), language, text);
        }
    });
}

test("detects the CSV delimiter", () => {
    assert.equal(detectCsvDelimiter("a,b\n1,2"), ",");
    assert.equal(detectCsvDelimiter("a;b\n1;2,5"), ";");
    assert.equal(detectCsvDelimiter("a\tb,c\n1\t2,3"), "\t");
    assert.equal(detectCsvDelimiter("a,b"), null);
    assert.equal(detectCsvDelimiter("a,b\n1,2,3\nx"), null);
    assert.equal(detectCsvDelimiter("select 1;\nselect 2;"), null);
});
