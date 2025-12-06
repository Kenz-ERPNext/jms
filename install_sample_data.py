#!/usr/bin/env python3
"""
Quick script to install JMS sample data
Run: bench --site jms.local execute jms.install_sample_data.install
"""

import frappe

def install():
	"""Install all sample data"""
	from jms.jms.fixtures.sample_data import install_sample_data

	frappe.connect()
	install_sample_data()
	frappe.db.commit()
	print("Sample data installed successfully!")

if __name__ == "__main__":
	install()
