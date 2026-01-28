#!/usr/bin/env python3
"""
Test script for Supabase and Pinecone connections.
Run this to verify your database configuration.
"""

import os
import sys

from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def test_supabase():
    """Test Supabase connection and basic operations."""
    print("\n" + "="*60)
    print("Testing Supabase connection")
    print("="*60)

    try:
        from supabase import Client, create_client

        url = os.getenv('SUPABASE_URL')
        key = os.getenv('SUPABASE_ANON_KEY')

        if not url or not key:
            print("Missing Supabase credentials in .env file")
            print("Required: SUPABASE_URL, SUPABASE_ANON_KEY")
            return False

        print(f"Connecting to: {url}")

        # Create client - supabase 2.3.4 uses positional arguments
        supabase: Client = create_client(url, key)
        print("Supabase client created successfully")

        # Test connection by fetching from a table (will fail if tables don't exist yet)
        try:
            response = supabase.table('documents').select("count", count='exact').execute()
            print(f"Documents table exists (count: {response.count})")
        except Exception as e:
            if "relation" in str(e).lower() and "does not exist" in str(e).lower():
                print("Database connected but no tables")
            else:
                print(f"Database connected but query failed: {str(e)}")

        # Test storage
        try:
            buckets = supabase.storage.list_buckets()
            print("Storage accessible")
            if buckets:
                print(f"Found {len(buckets)} bucket(s):")
                for bucket in buckets:
                    print(f"- {bucket.name} ({'public' if bucket.public else 'private'})")
            else:
                print("No storage buckets found yet")
        except Exception as e:
            print(f"Storage check failed: {str(e)}")

        return True

    except ImportError:
        print("Supabase package not installed")
        return False
    except Exception as e:
        print(f"Connection failed: {str(e)}")
        return False


def test_pinecone():
    """Test Pinecone connection and index access."""
    print("\n" + "="*60)
    print("TESTING PINECONE CONNECTION")
    print("="*60)

    try:
        from pinecone import Pinecone

        api_key = os.getenv('PINECONE_API_KEY')
        index_name = os.getenv('PINECONE_INDEX_NAME', 'knowledge-companion')

        if not api_key:
            print("Missing Pinecone credentials in .env file")
            print("Required: PINECONE_API_KEY")
            return False

        print(f"Connecting to {index_name}...")

        # Create client
        pc = Pinecone(api_key=api_key)
        print("Pinecone client created successfully")

        # List indexes
        try:
            indexes = pc.list_indexes()
            print("Pinecone api connection successful")

            if indexes:
                print(f"Found {len(indexes)} index(es):")
                for idx in indexes:
                    print(f"- {idx.name}")
            else:
                print("No indexes found")
                return False

            # Check if our index exists
            index_exists = any(idx.name == index_name for idx in indexes)

            if not index_exists:
                print(f"\nIndex '{index_name}' not found")
                return False

            # Connect to index
            index = pc.Index(index_name)
            print(f"\nConnected to index: {index_name}")

            # Get index stats
            stats = index.describe_index_stats()
            print(f"Total vectors: {stats.get('total_vector_count', 0)}")
            print(f"Dimensions: {stats.get('dimension', 'N/A')}")

            # Test upsert (with dummy vector)
            try:
                test_vector = [0.1] * stats.get('dimension', 768)
                index.upsert(vectors=[
                    {
                        "id": "test_connection_vector",
                        "values": test_vector,
                        "metadata": {
                            "test": True,
                            "user_id": "test_user"
                        }
                    }
                ])
                print("Test upsert successful")

                # Clean up test vector
                index.delete(ids=["test_connection_vector"])
                print("Test vector cleaned up")

            except Exception as e:
                print(f"Upsert test failed: {str(e)}")

            return True

        except Exception as e:
            print(f"Failed to access indexes: {str(e)}")
            return False

    except ImportError:
        print("Pinecone package not installed")
        return False
    except Exception as e:
        print(f"Connection failed: {str(e)}")
        return False


def main():
    """Run all connection tests."""
    print("\n" + "Database connection tests" + "\n")

    # Check if .env exists
    if not os.path.exists('.env'):
        print(".env file not found in backend/ directory")
        sys.exit(1)

    supabase_ok = test_supabase()
    pinecone_ok = test_pinecone()

    # Summary
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    print(f"Supabase: {'Connected' if supabase_ok else 'Failed'}")
    print(f"Pinecone: {'Connected' if pinecone_ok else 'Failed'}")

    if supabase_ok and pinecone_ok:
        print("\nAll connections are working")
        sys.exit(0)
    else:
        print("\nSome connections failed")
        sys.exit(1)


if __name__ == "__main__":
    main()
