import os
from datetime import datetime

from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from dotenv import load_dotenv
from sqlalchemy.exc import OperationalError


db = SQLAlchemy()

# Load environment variables from backend/.env when present.
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))


class TreeRecord(db.Model):
    __tablename__ = 'tree_records'

    id = db.Column(db.Integer, primary_key=True)
    tree_json = db.Column(db.JSON, nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'tree': self.tree_json,
            'createdAt': self.created_at.isoformat(),
            'updatedAt': self.updated_at.isoformat(),
        }


def validate_node(node, path='root'):
    if not isinstance(node, dict):
        return f'{path} must be an object.'

    if 'name' not in node or not isinstance(node['name'], str) or node['name'].strip() == '':
        return f'{path}.name is required and must be a non-empty string.'

    has_children = 'children' in node
    has_data = 'data' in node

    if has_children and has_data:
        return f'{path} must contain either children or data, not both.'

    if not has_children and not has_data:
        return f'{path} must contain either children or data.'

    if has_children:
        children = node['children']
        if not isinstance(children, list):
            return f'{path}.children must be an array.'

        for idx, child in enumerate(children):
            error = validate_node(child, f'{path}.children[{idx}]')
            if error:
                return error
    else:
        if not isinstance(node['data'], str):
            return f'{path}.data must be a string.'

    return None


def extract_tree_payload(payload):
    if isinstance(payload, dict) and 'tree' in payload:
        return payload['tree']
    return payload


def create_app():
    app = Flask(__name__)
    app.config['DB_READY'] = True

    db_url = os.getenv('DATABASE_URL', 'mysql+pymysql://root:password@localhost:3306/tagtree_db')
    app.config['SQLALCHEMY_DATABASE_URI'] = db_url
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    CORS(app)
    db.init_app(app)

    with app.app_context():
        try:
            db.create_all()
        except OperationalError:
            app.config['DB_READY'] = False

    @app.get('/')
    def home():
        return jsonify(
            {
                'message': 'AIMonk Flask backend is running.',
                'endpoints': [
                    {'method': 'GET', 'path': '/api/health'},
                    {'method': 'GET', 'path': '/api/trees'},
                    {'method': 'POST', 'path': '/api/trees'},
                    {'method': 'PUT', 'path': '/api/trees/<id>'},
                ],
            }
        )

    @app.get('/api/health')
    def health():
        return jsonify({'status': 'ok', 'dbReady': app.config['DB_READY']})

    def db_unavailable_response():
        return (
            jsonify(
                {
                    'error': 'Database is not reachable.',
                    'hint': 'Set a valid DATABASE_URL in Vercel backend environment variables.',
                }
            ),
            503,
        )

    @app.get('/api/trees')
    def get_trees():
        if not app.config['DB_READY']:
            return db_unavailable_response()

        records = TreeRecord.query.order_by(TreeRecord.id.asc()).all()
        return jsonify([record.to_dict() for record in records])

    @app.post('/api/trees')
    def create_tree():
        if not app.config['DB_READY']:
            return db_unavailable_response()

        payload = request.get_json(silent=True)
        if payload is None:
            return jsonify({'error': 'JSON body is required.'}), 400

        tree = extract_tree_payload(payload)
        validation_error = validate_node(tree)
        if validation_error:
            return jsonify({'error': validation_error}), 400

        record = TreeRecord(tree_json=tree)
        db.session.add(record)
        db.session.commit()

        return jsonify(record.to_dict()), 201

    @app.put('/api/trees/<int:tree_id>')
    def update_tree(tree_id):
        if not app.config['DB_READY']:
            return db_unavailable_response()

        payload = request.get_json(silent=True)
        if payload is None:
            return jsonify({'error': 'JSON body is required.'}), 400

        tree = extract_tree_payload(payload)
        validation_error = validate_node(tree)
        if validation_error:
            return jsonify({'error': validation_error}), 400

        record = TreeRecord.query.get(tree_id)
        if record is None:
            return jsonify({'error': 'Tree record not found.'}), 404

        record.tree_json = tree
        db.session.commit()

        return jsonify(record.to_dict())

    @app.errorhandler(404)
    def not_found(_error):
        return (
            jsonify(
                {
                    'error': 'Route not found.',
                    'hint': 'Use /api/health or /api/trees endpoints.',
                }
            ),
            404,
        )

    return app


app = create_app()


if __name__ == '__main__':
    app.run(debug=True, port=5000)
