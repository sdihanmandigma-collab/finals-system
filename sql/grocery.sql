CREATE DATABASE IF NOT EXISTS grocery_db;
USE grocery_db;

CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  image TEXT
);

CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_code VARCHAR(50) NOT NULL,
  order_date DATE NOT NULL,
  status VARCHAR(50) NOT NULL,
  items INT NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL
);

INSERT INTO products (category, name, price, image) VALUES
('Beverages', 'Nescafe Classic', 12, 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=600&q=80'),
('Snacks', 'Lucky Me Pancit Canton', 18, 'https://images.unsplash.com/photo-1617093727343-374698b1b08d?auto=format&fit=crop&w=600&q=80'),
('Pantry', 'Bear Brand Milk', 15, 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=600&q=80'),
('Frozen Food', 'Frozen Siomai', 85, 'https://images.unsplash.com/photo-1604908176997-431f4b2d7f3d?auto=format&fit=crop&w=600&q=80'),
('Softdrinks', 'Coca-Cola 1.5L', 72, 'https://images.unsplash.com/photo-1629203432180-71e9b1f44e7f?auto=format&fit=crop&w=600&q=80');