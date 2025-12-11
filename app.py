from flask import Flask, jsonify, request
app = Flask(__name__)

tasks= [
    {"id": 1, "title": "Task 1", "done": False},
    {"id": 1, "title": "Task 2", "done": False}
]

@app.route('/')
def home():
    return jsonify({"message": "Welcome to Task Manager API"})

@app.route('/tasks', methods=['GET'])
def get_tasks():
    return jsonify({"tasks": tasks})

@app.route('/tasks', methods=['POST'])
def add_task():
    new_task = request.get_json()
    tasks.append(new_task)
    return jsonify({"message": "Task added!", "task": new_task}), 201

@app.route('/tasks', methods=['DELETE'])
def delete_all():
    tasks.clear()
    return jsonify({"message": "All tasks deleted!"})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)